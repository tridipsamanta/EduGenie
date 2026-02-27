import { useNavigate } from "react-router-dom";
import { 
  GraduationCap, BookOpen, MessageSquare, FileText, Target, 
  Brain, Zap, ArrowRight, Home, ChevronRight 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Docs() {
  const navigate = useNavigate();

  const docSections = [
    {
      category: "Getting Started",
      articles: [
        { title: "Introduction to EduGenie", icon: Home, href: "/docs/getting-started" },
        { title: "Creating Your Account", icon: BookOpen, href: "/docs/account-setup" },
        { title: "Quick Start Guide", icon: Zap, href: "/docs/quick-start" },
      ]
    },
    {
      category: "Core Features",
      articles: [
        { title: "AI Tutor Chat", icon: MessageSquare, href: "/docs/ai-tutor" },
        { title: "MCQ Generator", icon: FileText, href: "/docs/mcq-generator" },
        { title: "Mock Tests", icon: Target, href: "/docs/mock-tests" },
        { title: "Smart Notes", icon: Brain, href: "/docs/smart-notes" },
      ]
    },
    {
      category: "Advanced Topics",
      articles: [
        { title: "Weak Topic Detection", icon: Target, href: "/docs/weak-topics" },
        { title: "Revision Planning", icon: BookOpen, href: "/docs/revision-planner" },
        { title: "Progress Analytics", icon: Zap, href: "/docs/analytics" },
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="h-16 flex items-center justify-between">
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <div className="h-8 w-8 bg-gradient-to-br from-purple-700 to-violet-800 rounded-lg flex items-center justify-center shadow-lg shadow-purple-700/20 overflow-hidden">
                <img 
                  src="/app_logo.png" 
                  alt="EduGenie Logo" 
                  className="h-8 w-8 object-cover brightness-0 invert"
                />
              </div>
              <span className="font-bold text-xl">EduGenie</span>
            </button>
            <Button onClick={() => navigate('/sign-in')}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-indigo-50 to-white">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Documentation
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Everything you need to master EduGenie
          </p>
          
          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="Search documentation..."
                className="w-full px-6 py-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Documentation Grid */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-12">
            {docSections.map((section) => (
              <div key={section.category}>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">{section.category}</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {section.articles.map((article) => {
                    const Icon = article.icon;
                    return (
                      <Card 
                        key={article.title}
                        className="hover:shadow-lg transition-shadow cursor-pointer group"
                        onClick={() => navigate(article.href)}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                              <Icon className="h-6 w-6" />
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">{article.title}</h3>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Guides */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Popular Guides</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <GuideLink 
              title="How to Generate Your First Quiz"
              description="Step-by-step tutorial for creating practice MCQs"
              href="/docs/first-quiz"
            />
            <GuideLink 
              title="Maximizing AI Tutor Responses"
              description="Tips for getting better explanations from the AI"
              href="/docs/ai-tips"
            />
            <GuideLink 
              title="Understanding Your Analytics"
              description="Learn how to interpret your progress data"
              href="/docs/analytics-guide"
            />
            <GuideLink 
              title="Study Plan Best Practices"
              description="Create effective revision schedules"
              href="/docs/study-plans"
            />
          </div>
        </div>
      </section>

      {/* Help Section */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Still need help?</h2>
          <p className="text-lg text-gray-600 mb-8">
            Our support team is here to assist you
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="outline" size="lg" className="px-8">
              Join Discord Community
            </Button>
            <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-violet-600 px-8">
              Contact Support
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="h-6 w-6 bg-gradient-to-br from-purple-700 to-violet-800 rounded-lg flex items-center justify-center shadow-lg shadow-purple-700/20 overflow-hidden">
                <img 
                  src="/app_logo.png" 
                  alt="EduGenie Logo" 
                  className="h-6 w-6 object-cover brightness-0 invert"
                />
              </div>
              <span className="text-white font-bold">EduGenie</span>
            </div>
            <div className="flex items-center gap-6">
              <button onClick={() => navigate('/')} className="hover:text-white transition-colors">
                Home
              </button>
              <button onClick={() => navigate('/docs')} className="hover:text-white transition-colors">
                Docs
              </button>
              <a href="#" className="hover:text-white transition-colors">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function GuideLink({ title, description, href }: { title: string; description: string; href: string }) {
  const navigate = useNavigate();
  
  return (
    <button
      onClick={() => navigate(href)}
      className="text-left p-6 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
            {title}
          </h3>
          <p className="text-gray-600 text-sm">{description}</p>
        </div>
        <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 transition-colors flex-shrink-0 ml-4" />
      </div>
    </button>
  );
}
