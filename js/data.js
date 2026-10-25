/* ============================================================
   AI Interview Prep — Demo Data
   All content here is static demo/mock data used to simulate
   an AI backend for presentation purposes.
   ============================================================ */

const QUESTION_BANK = [
  { id: 1,  category: "HR", difficulty: "Beginner", text: "Tell me about yourself." },
  { id: 2,  category: "HR", difficulty: "Beginner", text: "Why should we hire you?" },
  { id: 3,  category: "HR", difficulty: "Intermediate", text: "What are your strengths and weaknesses?" },
  { id: 4,  category: "HR", difficulty: "Intermediate", text: "Where do you see yourself in five years?" },
  { id: 5,  category: "HR", difficulty: "Beginner", text: "Why do you want to work at our company?" },
  { id: 6,  category: "HR", difficulty: "Advanced", text: "How do you handle conflict with a coworker?" },
  { id: 7,  category: "Technical", difficulty: "Beginner", text: "What is the difference between a stack and a queue?" },
  { id: 8,  category: "Technical", difficulty: "Intermediate", text: "Explain how a hash map works internally." },
  { id: 9,  category: "Technical", difficulty: "Intermediate", text: "What is the difference between SQL and NoSQL databases?" },
  { id: 10, category: "Technical", difficulty: "Advanced", text: "How would you design a URL shortening service?" },
  { id: 11, category: "Technical", difficulty: "Advanced", text: "Explain the CAP theorem with a real-world example." },
  { id: 12, category: "Technical", difficulty: "Beginner", text: "What is the difference between REST and GraphQL?" },
  { id: 13, category: "Behavioral", difficulty: "Intermediate", text: "Describe a challenging project you worked on." },
  { id: 14, category: "Behavioral", difficulty: "Intermediate", text: "Tell me about a time you failed and what you learned." },
  { id: 15, category: "Behavioral", difficulty: "Advanced", text: "Describe a situation where you had to lead a team under pressure." },
  { id: 16, category: "Behavioral", difficulty: "Beginner", text: "Tell me about a time you worked well in a team." },
  { id: 17, category: "Situational", difficulty: "Intermediate", text: "What would you do if you disagreed with your manager's decision?" },
  { id: 18, category: "Situational", difficulty: "Advanced", text: "How would you handle a project falling behind schedule right before a deadline?" },
  { id: 19, category: "Situational", difficulty: "Beginner", text: "How would you prioritize multiple urgent tasks?" },
  { id: 20, category: "Communication", difficulty: "Beginner", text: "How do you explain a technical concept to a non-technical person?" },
  { id: 21, category: "Communication", difficulty: "Intermediate", text: "Describe a time you had to persuade someone to see your point of view." },
  { id: 22, category: "Communication", difficulty: "Advanced", text: "How do you handle giving difficult feedback to a peer?" },
  { id: 23, category: "Aptitude", difficulty: "Beginner", text: "If a train travels 60 km in 45 minutes, what is its speed in km/h?" },
  { id: 24, category: "Aptitude", difficulty: "Intermediate", text: "A shopkeeper marks up a product by 25% and gives a 10% discount. What is his net profit percentage?" },
  { id: 25, category: "Aptitude", difficulty: "Advanced", text: "Find the next number in the series: 2, 6, 12, 20, 30, ?" },
];

const INTERVIEW_QUESTION_SETS = {
  HR: [
    "Tell me about yourself and your background.",
    "Why do you want to work with us?",
    "What are your greatest strengths?",
    "What is your biggest weakness?",
    "Where do you see yourself in five years?",
    "Why should we hire you over other candidates?",
    "What motivates you to do your best work?",
    "How do you handle stress and pressure?",
  ],
  Technical: [
    "Explain the difference between an array and a linked list.",
    "What is time complexity and why does it matter?",
    "How does garbage collection work?",
    "Explain the concept of REST APIs.",
    "What is the difference between synchronous and asynchronous code?",
    "How would you optimize a slow database query?",
    "Explain object-oriented programming with an example.",
    "What is the difference between a process and a thread?",
  ],
  Behavioral: [
    "Describe a challenging project you worked on and how you handled it.",
    "Tell me about a time you failed and what you learned from it.",
    "Describe a time you had to work with a difficult teammate.",
    "Tell me about a decision you made without complete information.",
    "Describe a time you went above and beyond at work or college.",
    "Tell me about a goal you set and how you achieved it.",
  ],
  Managerial: [
    "How do you prioritize tasks for your team?",
    "Describe a time you had to resolve a conflict between team members.",
    "How do you handle underperforming team members?",
    "How do you delegate responsibilities effectively?",
    "Describe your leadership style.",
    "How do you handle disagreement with senior stakeholders?",
  ],
  "Campus Placement": [
    "Why did you choose this branch/field of study?",
    "Tell us about your final year project.",
    "What extracurricular activities have you been part of?",
    "Why should we recruit from your college?",
    "What are your expectations from this role?",
    "How do you plan to balance work and further studies, if any?",
  ],
  Internship: [
    "Why are you interested in this internship?",
    "What do you hope to learn from this internship?",
    "Tell me about a course project relevant to this role.",
    "How do you manage your time between studies and other commitments?",
    "What skills are you hoping to develop during this internship?",
  ],
};

const SKILL_QUESTION_MAP = {
  python: [
    "What are Python decorators and when would you use them?",
    "Explain the difference between a list and a tuple in Python.",
    "How does Python's garbage collection work?",
  ],
  java: [
    "Explain the difference between JVM, JRE, and JDK.",
    "What is the purpose of the 'final' keyword in Java?",
    "How does exception handling work in Java?",
  ],
  "machine learning": [
    "Explain the bias-variance tradeoff.",
    "What is overfitting and how can you prevent it?",
    "Walk me through how you would evaluate a classification model.",
  ],
  sql: [
    "What is the difference between INNER JOIN and LEFT JOIN?",
    "How would you optimize a slow SQL query?",
    "Explain normalization and why it's important.",
  ],
  javascript: [
    "Explain the concept of closures in JavaScript.",
    "What is the difference between '==' and '===' ?",
    "How does the event loop work in JavaScript?",
  ],
  react: [
    "What is the virtual DOM and how does it improve performance?",
    "Explain the difference between state and props.",
    "What are React hooks and why were they introduced?",
  ],
  "data structures": [
    "When would you use a hash map over an array?",
    "Explain how a binary search tree works.",
    "What is the time complexity of common sorting algorithms?",
  ],
  "cloud": [
    "What is the difference between IaaS, PaaS, and SaaS?",
    "How would you design a fault-tolerant cloud application?",
    "Explain the concept of auto-scaling.",
  ],
  "ui/ux": [
    "How do you approach user research before designing a screen?",
    "Explain the concept of a design system.",
    "How do you balance aesthetics with usability?",
  ],
  marketing: [
    "How would you plan a go-to-market strategy for a new product?",
    "How do you measure the success of a marketing campaign?",
    "Explain the difference between B2B and B2C marketing strategies.",
  ],
  "business analysis": [
    "How do you gather requirements from stakeholders?",
    "Describe a time you translated business needs into technical specs.",
    "What tools do you use for process mapping?",
  ],
  "cybersecurity": [
    "What is the difference between symmetric and asymmetric encryption?",
    "Explain what a SQL injection attack is and how to prevent it.",
    "What steps would you take after detecting a security breach?",
  ],
};

const RESOURCES = [
  { icon: "💡", title: "Interview Tips", desc: "Practical tips to walk into any interview with confidence and clarity." },
  { icon: "📄", title: "Resume Tips", desc: "Craft a resume that highlights your impact and passes ATS screening." },
  { icon: "🗣️", title: "Communication Skills", desc: "Improve clarity, tone, and structure when speaking under pressure." },
  { icon: "🧍", title: "Body Language", desc: "Non-verbal cues that project confidence in video and in-person interviews." },
  { icon: "❓", title: "Common HR Questions", desc: "The most frequently asked HR questions and how to answer them well." },
  { icon: "⚙️", title: "Technical Interview Tips", desc: "Strategies for whiteboard coding, system design, and CS fundamentals." },
  { icon: "⭐", title: "STAR Method", desc: "Structure behavioral answers using Situation, Task, Action, Result." },
  { icon: "💰", title: "Salary Negotiation Basics", desc: "How to research, present, and negotiate an offer confidently." },
];

const BADGES = [
  { id: "first",     icon: "🏆", name: "First Interview",        desc: "Complete your first mock interview" },
  { id: "ten_q",      icon: "🎯", name: "10 Questions Completed", desc: "Answer 10 practice questions" },
  { id: "streak",     icon: "🔥", name: "7-Day Practice Streak",  desc: "Practice for 7 days in a row" },
  { id: "technical",  icon: "💡", name: "Technical Expert",       desc: "Score 85+ on 3 technical interviews" },
  { id: "ready",      icon: "🚀", name: "Interview Ready",        desc: "Reach 90% interview readiness" },
];

const JOB_ROLES = [
  "Software Developer", "Data Analyst", "Web Developer", "Cybersecurity Analyst",
  "UI/UX Designer", "Marketing Executive", "Business Analyst", "Data Scientist",
  "Cloud Engineer", "Product Manager",
];
