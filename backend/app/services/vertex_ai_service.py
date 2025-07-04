import vertexai
from vertexai.generative_models import GenerativeModel
from google.cloud import discoveryengine_v1 as discoveryengine
from app.config import settings
from app.models.responses import GroundingMetadata, GroundingChunk, GroundingChunkWeb
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class VertexAIService:
    def __init__(self):
        self.project_id = settings.PROJECT_ID
        self.location = settings.LOCATION
        self.data_store_id = settings.DATA_STORE_ID
        
        # Initialize Vertex AI
        vertexai.init(project=self.project_id, location=settings.VERTEX_AI_LOCATION)
        
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

    def search_documents(self, query: str, page_size: int = 5) -> tuple[str, Optional[GroundingMetadata]]:
        """Search documents using Vertex AI Search"""
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
            return "No relevant context found.", None

    def generate_content(self, prompt: str) -> str:
        """Generate content using Gemini model"""
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Error generating content: {e}")
            raise Exception(f"Failed to generate content: {str(e)}")

    def chat_with_context(self, message: str, history: list, context: str) -> str:
        """Generate chat response with context"""
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
        
        return self.generate_content(prompt)