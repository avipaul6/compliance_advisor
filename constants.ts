import React from 'react';

// RAG and Model constants are removed as they are now backend concerns.

export const ICONS = {
  documentText: (className = "w-6 h-6") =>
    React.createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      viewBox: "0 0 24 24",
      strokeWidth: 1.5,
      stroke: "currentColor",
      className: className,
    },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M9 12h6m-6 3h4m-4 4H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2h-1"
      })
    ),
  lightBulb: (className = "w-6 h-6") =>
    React.createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      viewBox: "0 0 24 24",
      strokeWidth: 1.5,
      stroke: "currentColor",
      className: className,
    },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.311a7.5 7.5 0 01-7.5 0c.887-1.144 2.54-1.144 4.5 0z"
      })
    ),
  clipboardList: (className = "w-6 h-6") =>
    React.createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      viewBox: "0 0 24 24",
      strokeWidth: 1.5,
      stroke: "currentColor",
      className: className,
    },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      })
    ),
  checkCircle: (className = "w-6 h-6") =>
    React.createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      viewBox: "0 0 24 24",
      strokeWidth: 1.5,
      stroke: "currentColor",
      className: className,
    },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
      })
    ),
  exclamationTriangle: (className = "w-6 h-6") =>
    React.createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      viewBox: "0 0 24 24",
      strokeWidth: 1.5,
      stroke: "currentColor",
      className: className,
    },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
      })
    ),
  arrowPath: (className = "w-6 h-6") =>
    React.createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      viewBox: "0 0 24 24",
      strokeWidth: 1.5,
      stroke: "currentColor",
      className: className,
    },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.667 0l3.181-3.183m-11.667-11.667l3.181 3.183a8.25 8.25 0 0111.667 0l3.181-3.183",
      })
    ),
  bookOpen: (className = "w-6 h-6") =>
    React.createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      viewBox: "0 0 24 24",
      strokeWidth: 1.5,
      stroke: "currentColor",
      className: className,
    },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25",
      })
    ),
  calendarDays: (className = "w-6 h-6") =>
    React.createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      viewBox: "0 0 24 24",
      strokeWidth: 1.5,
      stroke: "currentColor",
      className: className,
    },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5",
      })
    ),
  link: (className = "w-6 h-6") =>
    React.createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      viewBox: "0 0 24 24",
      strokeWidth: 1.5,
      stroke: "currentColor",
      className: className,
    },
      React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244",
      })
    ),
  arrowUpTray: (className = "w-6 h-6") =>
    React.createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: className,
    }, React.createElement("path", {
      strokeLinecap: "round", strokeLinejoin: "round", d: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
    })),
  trash: (className = "w-6 h-6") =>
    React.createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: className
    }, React.createElement("path", {
      strokeLinecap: "round", strokeLinejoin: "round", d: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
    })),
  archiveBox: (className = "w-6 h-6") => 
    React.createElement("svg", {
        xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: className
    }, React.createElement("path", {
        strokeLinecap: "round", strokeLinejoin: "round", d: "M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.372-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18h-1.875a3.375 3.375 0 00-3.375-3.375H9.375a3.375 3.375 0 00-3.375 3.375H4.125M15.75 18V15a2.25 2.25 0 00-2.25-2.25H10.5A2.25 2.25 0 008.25 15v3M12 12h.008v.008H12V12zm0 0H8.25m3.75 0H15.75M3.375 21h17.25c1.035 0 1.875-.84 1.875-1.875V5.625c0-1.036-.84-1.875-1.875-1.875H3.375C2.34 3.75 1.5 4.59 1.5 5.625v13.5c0 1.035.84 1.875 1.875 1.875z"
    })),
  archiveBoxXMark: (className = "w-6 h-6") => 
    React.createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: className
    }, React.createElement("path", {
      strokeLinecap: "round", strokeLinejoin: "round", d: "M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.372-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18h-1.875a3.375 3.375 0 00-3.375-3.375H9.375a3.375 3.375 0 00-3.375 3.375H4.125M15.75 18V15a2.25 2.25 0 00-2.25-2.25H10.5A2.25 2.25 0 008.25 15v3M12 12h.008v.008H12V12zm0 0H8.25m3.75 0H15.75m-7.5-3L8.25 9m0 0L6 6.75M8.25 9l-2.25-2.25M15.75 9l2.25-2.25m0 0L15.75 9m2.25-2.25L13.5 9M3.375 21h17.25c1.035 0 1.875-.84 1.875-1.875V5.625c0-1.036-.84-1.875-1.875-1.875H3.375C2.34 3.75 1.5 4.59 1.5 5.625v13.5c0 1.035.84 1.875 1.875 1.875Z"
    })),
  folder: (className = "w-6 h-6") =>
    React.createElement("svg", {
        xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: className
    }, 
      React.createElement("path", {
        strokeLinecap: "round", strokeLinejoin: "round", d: "M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
      })
    ),
  folderOpen: (className = "w-6 h-6") =>
    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: className },
      React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6.375a2.25 2.25 0 00-2.25 2.25v3.375c0 1.24 1.01 2.25 2.25 2.25zM17.25 12a2.25 2.25 0 012.25-.225 2.25 2.25 0 012.25 2.25v3.375c0 1.24-1.01 2.25-2.25 2.25h-1.5a2.25 2.25 0 01-2.25-2.25v-3.375c0-.988.626-1.813 1.5-2.125z" })
    ),
  chatBubbleLeftRight: (className = "w-6 h-6") =>
    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: className },
      React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193l-3.72 3.72a2.25 2.25 0 01-3.182 0l-3.72-3.72A2.25 2.25 0 013.75 14.894v-4.286c0-.97.616-1.813 1.5-2.097M16.5 7.5v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a3.375 3.375 0 00-3.375 3.375v1.875m9 0h-9" })
    ),
  informationCircle: (className = "w-6 h-6") =>
    React.createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: className
      }, React.createElement("path", {
        strokeLinecap: "round", strokeLinejoin: "round", d: "m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
      })
    ),
  cpuChip: (className = "w-6 h-6") =>
    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: className },
      React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 21v-1.5M15.75 3v1.5m0 16.5v-1.5M12 5.25v-1.5m0 16.5v-1.5m-3.75-15h7.5a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25-2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-7.5A2.25 2.25 0 018.25 6z" })
  ),
  cloudArrowUp: (className = "w-6 h-6") =>
    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: className },
      React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M17.25 21H6.75a4.5 4.5 0 01-4.5-4.5V7.5a4.5 4.5 0 014.5-4.5h7.5a4.5 4.5 0 014.5 4.5v4.625a2.625 2.625 0 001.625 2.458" })
  ),
  documentSearch: (className = "w-6 h-6") => // Icon for Document Deep Dive
    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: className },
      React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M15.75 17.25l-2.06-2.06m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 008.494 10.004zM10.5 7.5H18m-7.5 3H18m-7.5 3H15M3 3h6l7.5 7.5M3 3v18h18" }) // Combines a document feel with a search magnifying glass
  ),
  chevronDown: (className = "w-6 h-6") =>
    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: className },
      React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "m19.5 8.25-7.5 7.5-7.5-7.5" })
    )
};

// LocalStorage Keys
export const CHAT_HISTORY_KEY = 'complianceChatHistory';
export const INTERNAL_CORPUS_KEY = 'complianceInternalCorpus';
export const USER_AUSTRAC_CONTENT_KEY = 'userAustracContent';
export const SUMMARIZED_AUSTRAC_UPDATES_KEY = 'summarizedUserAustracUpdates'; // Note: This might be dynamic based on App.tsx logic, not directly stored/loaded.
export const SAVED_ANALYSES_KEY = 'complianceSavedAnalyses';
export const ACTIVE_ANALYSIS_ID_KEY = 'complianceActiveAnalysisId';
export const CHATBOT_LEARNINGS_KEY = 'complianceChatbotLearnings';
