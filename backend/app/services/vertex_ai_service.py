# backend/app/services/vertex_ai_service.py

import vertexai
from vertexai.generative_models import GenerativeModel
from google.cloud import discoveryengine_v1 as discoveryengine
from google.auth import default
from google.auth.exceptions import DefaultCredentialsError
from app.config import settings
from app.models.responses import GroundingMetadata, GroundingChunk, GroundingChunkWeb
from typing import Optional, List, Dict, Any
import logging
import json
import re

logger = logging.getLogger(__name__)

class VertexAIService:
    def __init__(self):
        self.project_id = settings.PROJECT_ID
        self.location = settings.LOCATION
        self.data_store_id = settings.DATA_STORE_ID
        
        try:
            # Initialize Vertex AI with environment-aware authentication
            self._initialize_vertex_ai()
            
            # Initialize Gemini model
            self.model = GenerativeModel(settings.GEMINI_MODEL)
            
            # Initialize search client
            self.search_client = discoveryengine.SearchServiceClient()
            
            # Construct serving config path
            self.serving_config_path = self.search_client.serving_config_path(
                project=self.project_id,
                location=self.location,
                data_store=self.data_store_id,
                serving_config="default_config",
            )
            
            logger.info(f"Vertex AI initialized successfully in {'cloud' if settings.IS_CLOUD_ENVIRONMENT else 'local'} environment")
            
        except Exception as e:
            logger.error(f"Failed to initialize Vertex AI: {e}")
            # Don't raise exception - allow service to start but log the error
            self.model = None
            self.search_client = None
            self.serving_config_path = None

    def _initialize_vertex_ai(self):
        """Initialize Vertex AI with appropriate credentials based on environment"""
        try:
            if settings.IS_CLOUD_ENVIRONMENT:
                logger.info("Running in cloud environment - using default service account")
                # Cloud Run will automatically use the service account
                vertexai.init(project=self.project_id, location=settings.VERTEX_AI_LOCATION)
            else:
                logger.info("Running in local environment - using user credentials")
                # For local development, try to use user credentials from gcloud
                try:
                    # Check if we can get default credentials
                    credentials, project = default()
                    logger.info(f"Using credentials for project: {project}")
                    vertexai.init(
                        project=self.project_id, 
                        location=settings.VERTEX_AI_LOCATION,
                        credentials=credentials
                    )
                except DefaultCredentialsError:
                    logger.warning("No default credentials found. Make sure to run 'gcloud auth login' and 'gcloud auth application-default login'")
                    # Initialize without credentials - will fail on actual calls but allows service to start
                    vertexai.init(project=self.project_id, location=settings.VERTEX_AI_LOCATION)
                    
        except Exception as e:
            logger.error(f"Error initializing Vertex AI: {e}")
            raise

    def search_documents(self, query: str, page_size: int = 5) -> tuple[str, Optional[GroundingMetadata]]:
        """Search documents using Vertex AI Search"""
        if not self.search_client or not self.serving_config_path:
            logger.error("Vertex AI Search not properly initialized")
            return "Vertex AI Search is not available. Please check configuration.", None
            
        try:
            search_request = discoveryengine.SearchRequest(
                serving_config=self.serving_config_path,
                query=query,
                page_size=page_size,
                content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
                    snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
                        return_snippet=True
                    ),
                    summary_spec=discoveryengine.SearchRequest.ContentSearchSpec.SummarySpec(
                        summary_result_count=5,
                        include_citations=True,
                    ),
                ),
            )
            
            search_response = self.search_client.search(search_request)
            context_str = search_response.summary.summary_text
            
            # For now, return the summary text and no grounding metadata
            # TODO: Parse search results for proper grounding metadata
            return context_str, None
            
        except Exception as e:
            logger.error(f"Error in document search: {e}")
            return f"Search temporarily unavailable: {str(e)}", None

    def search_compliance_context(self, document_content: str, document_name: str) -> tuple[str, Optional[GroundingMetadata]]:
        """
        Search for compliance-relevant context for a specific document
        Uses multiple targeted queries to find regulatory requirements
        """
        if not self.search_client or not self.serving_config_path:
            logger.error("Vertex AI Search not properly initialized")
            return "Search unavailable", None

        # Extract key themes from document for targeted searching
        key_themes = self._extract_document_themes(document_content, document_name)
        
        # Perform multiple targeted searches
        all_context = []
        all_sources = []
        
        for theme in key_themes:
            try:
                # Create compliance-focused search query
                compliance_query = f"regulatory requirements compliance obligations {theme}"
                
                search_request = discoveryengine.SearchRequest(
                    serving_config=self.serving_config_path,
                    query=compliance_query,
                    page_size=3,  # Smaller page size for multiple queries
                    content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
                        snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
                            return_snippet=True
                        ),
                        summary_spec=discoveryengine.SearchRequest.ContentSearchSpec.SummarySpec(
                            summary_result_count=3,
                            include_citations=True,
                        ),
                    ),
                )
                
                search_response = self.search_client.search(search_request)
                
                if search_response.summary.summary_text:
                    all_context.append(f"**{theme} Requirements:**\n{search_response.summary.summary_text}")
                
                # Extract web sources (simplified for now)
                for result in search_response.results:
                    if hasattr(result.document, 'derived_struct_data'):
                        # Extract any web links if available
                        pass  # TODO: Parse actual web sources from results
                        
            except Exception as e:
                logger.warning(f"Search failed for theme '{theme}': {e}")
                continue
        
        combined_context = "\n\n".join(all_context) if all_context else "No specific regulatory context found."
        
        # TODO: Build proper GroundingMetadata from search results
        grounding = None
        
        return combined_context, grounding

    def _extract_document_themes(self, document_content: str, document_name: str) -> List[str]:
        """
        Extract key compliance themes from document content
        Uses simple keyword extraction - could be enhanced with AI
        """
        # Common compliance themes for financial services
        base_themes = [
            "customer identification",
            "know your customer KYC", 
            "anti money laundering AML",
            "sanctions screening",
            "transaction monitoring",
            "risk assessment",
            "due diligence",
            "record keeping",
            "reporting requirements"
        ]
        
        # Add document-specific themes based on filename
        doc_lower = document_name.lower()
        if "onboard" in doc_lower or "kyc" in doc_lower:
            base_themes.extend(["customer onboarding", "identity verification"])
        elif "transaction" in doc_lower:
            base_themes.extend(["payment processing", "transaction limits"])
        elif "risk" in doc_lower:
            base_themes.extend(["risk management", "compliance monitoring"])
        
        # Filter themes based on document content (simple keyword matching)
        content_lower = document_content.lower()
        relevant_themes = []
        
        for theme in base_themes:
            # Check if theme keywords appear in document
            theme_keywords = theme.lower().split()
            if any(keyword in content_lower for keyword in theme_keywords):
                relevant_themes.append(theme)
        
        # Return top 5 most relevant themes, or fallback themes
        return relevant_themes[:5] if relevant_themes else ["compliance requirements", "regulatory obligations"]

    def analyze_document_compliance(self, document_content: str, document_name: str) -> Dict[str, Any]:
        """
        Perform comprehensive compliance analysis of a document
        Returns structured analysis with suggestions and action items
        """
        if not self.model:
            raise Exception("Vertex AI model not properly initialized")

        # 1. Search for relevant compliance context
        logger.info(f"Searching compliance context for document: {document_name}")
        compliance_context, grounding = self.search_compliance_context(document_content, document_name)

        # 2. Generate structured analysis using Gemini
        analysis_prompt = self._build_analysis_prompt(document_content, document_name, compliance_context)
        
        try:
            logger.info("Generating compliance analysis with Gemini")
            response = self.model.generate_content(analysis_prompt)
            
            # 3. Parse structured response
            analysis_result = self._parse_analysis_response(response.text, document_name)
            
            # 4. Add grounding metadata
            analysis_result["grounding_metadata"] = grounding
            
            return analysis_result
            
        except Exception as e:
            logger.error(f"Error in compliance analysis: {e}")
            raise Exception(f"Failed to analyze document: {str(e)}")

    def _build_analysis_prompt(self, document_content: str, document_name: str, compliance_context: str) -> str:
        """Build the prompt for Gemini to analyze document compliance"""
        
        return f"""You are a compliance expert analyzing a financial services document for regulatory compliance gaps and improvement opportunities.

**Document to Analyze:**
Name: {document_name}
Content: {document_content[:8000]}  # Truncate to fit context

**Relevant Regulatory Context:**
{compliance_context}

**Your Task:**
Analyze this document against regulatory requirements and provide a structured response in JSON format with the following structure:

{{
    "overall_summary": "Brief summary of document's compliance status and main observations",
    "key_themes": ["list", "of", "main", "compliance", "themes", "found"],
    "suggested_changes": [
        {{
            "id": "unique_id",
            "document_section": "specific section or clause",
            "current_status_summary": "what the document currently says",
            "austrac_relevance": "how this relates to regulatory requirements", 
            "suggested_modification": "specific improvement recommendation",
            "priority": "High|Medium|Low",
            "basis_of_suggestion": "Legislation|Web Search|General Knowledge"
        }}
    ],
    "action_plan": [
        {{
            "id": "unique_id", 
            "task": "specific action to take",
            "responsible": "who should handle this",
            "timeline": "when to complete",
            "priority_level": "High|Medium|Low"
        }}
    ],
    "additional_observations": "Any other relevant observations about the document"
}}

**Analysis Guidelines:**
- Focus on practical, actionable improvements
- Prioritize High items for critical compliance gaps
- Be specific about document sections that need changes
- Consider Australian financial services regulations (AUSTRAC, ASIC, etc.)
- Suggest realistic timelines and responsible parties
- Provide clear rationale for each suggestion

Generate your analysis now:"""

    def _parse_analysis_response(self, response_text: str, document_name: str) -> Dict[str, Any]:
        """Parse Gemini's response into structured format"""
        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                analysis_data = json.loads(json_str)
                
                # Add unique IDs if missing and ensure proper structure
                return self._validate_and_enhance_analysis(analysis_data, document_name)
            else:
                logger.warning("No JSON found in response, creating fallback structure")
                return self._create_fallback_analysis(response_text, document_name)
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            return self._create_fallback_analysis(response_text, document_name)

    def _validate_and_enhance_analysis(self, analysis_data: Dict[str, Any], document_name: str) -> Dict[str, Any]:
        """Validate and enhance the parsed analysis data"""
        import uuid
        
        # Ensure required fields exist
        analysis_data.setdefault("overall_summary", "Analysis completed")
        analysis_data.setdefault("key_themes", ["General compliance review"])
        analysis_data.setdefault("suggested_changes", [])
        analysis_data.setdefault("action_plan", [])
        analysis_data.setdefault("additional_observations", "")
        
        # Add missing IDs and validate structure
        for i, change in enumerate(analysis_data["suggested_changes"]):
            if "id" not in change:
                change["id"] = f"ddsc-{str(uuid.uuid4())[:8]}"
            # Ensure all required fields exist
            change.setdefault("priority", "Medium")
            change.setdefault("basis_of_suggestion", "General Knowledge")
        
        for i, item in enumerate(analysis_data["action_plan"]):
            if "id" not in item:
                item["id"] = f"ddap-{str(uuid.uuid4())[:8]}"
            # Ensure all required fields exist
            item.setdefault("priority_level", "Medium")
        
        return analysis_data

    def _create_fallback_analysis(self, response_text: str, document_name: str) -> Dict[str, Any]:
        """Create a fallback analysis structure when parsing fails"""
        import uuid
        
        return {
            "overall_summary": f"Analysis completed for {document_name}. Full response: {response_text[:500]}...",
            "key_themes": ["Document analysis", "Compliance review"],
            "suggested_changes": [
                {
                    "id": f"ddsc-{str(uuid.uuid4())[:8]}",
                    "document_section": "General Review",
                    "current_status_summary": "Document reviewed by AI",
                    "austrac_relevance": "General compliance considerations",
                    "suggested_modification": "Review document based on AI analysis",
                    "priority": "Medium",
                    "basis_of_suggestion": "General Knowledge"
                }
            ],
            "action_plan": [
                {
                    "id": f"ddap-{str(uuid.uuid4())[:8]}",
                    "task": "Review AI analysis and implement recommendations",
                    "responsible": "Compliance Team",
                    "timeline": "Next Quarter",
                    "priority_level": "Medium"
                }
            ],
            "additional_observations": response_text[:1000] if response_text else "No additional observations"
        }

    def generate_content(self, prompt: str) -> str:
        """Generate content using Gemini model"""
        if not self.model:
            raise Exception("Vertex AI model not properly initialized")
            
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Error generating content: {e}")
            raise Exception(f"Failed to generate content: {str(e)}")

    def chat_with_context(self, message: str, history: list, context: str) -> str:
        """Generate chat response with context"""
        if not self.model:
            return "Chat service is temporarily unavailable. Please check Vertex AI configuration."
            
        chat_history_formatted = "\n".join([f"{msg['sender']}: {msg['text']}" for msg in history])
        
        prompt = f"""You are a compliance assistant chatbot named Vera. Your purpose is to help answer questions based on the user's uploaded documents.
        
        Use the following summary of retrieved document chunks to answer the user's question. If the context does not contain the answer, state that you could not find the information in the provided documents. Do not make up information. Always cite your sources using the format [number] from the summary.

        **Retrieved Context Summary:**
        {context}
        
        **Chat History:**
        {chat_history_formatted}

        **User's new question:** {message}
        
        **Your Answer:**
        """
        
        try:
            return self.generate_content(prompt)
        except Exception as e:
            logger.error(f"Error in chat response: {e}")
            return f"I'm having trouble processing your request right now. Error: {str(e)}"