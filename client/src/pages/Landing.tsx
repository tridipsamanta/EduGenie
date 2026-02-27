import { SignInButton, SignUpButton, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  GraduationCap, ArrowRight, Menu, X,
  MessageSquare, FileText, Target, Brain, TrendingUp, Calendar,
  CheckCircle2, Star, ChevronDown, ChevronUp,
  Github, Twitter, Mail, BookOpen, Zap, Moon, Sun
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ScrollyTutor from "@/components/ScrollyTutor";
import { useTheme } from "@/components/theme-provider";

export default function Landing() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [isScrolledPastHero, setIsScrolledPastHero] = useState(false);

  useEffect(() => {
    // Force scroll to top on mount/refresh to prevent Framer Motion physics engine
    // from breaking if the browser tries to restore previous scroll position halfway down the page
    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
    const handleScroll = () => {
      // The Hero section is 400vh tall (window.innerHeight * 4)
      // Transition the navbar slightly before we completely leave the canvas
      const threshold = window.innerHeight * 3.8;
      setIsScrolledPastHero(window.scrollY > threshold);
    };

    // Initial check
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const navItems = [
    { label: "Features", href: "#features" },
    { label: "How it Works", href: "#how-it-works" },
    { label: "Demo", href: "#demo" },
    { label: "Reviews", href: "#reviews" },
    { label: "Pricing", href: "#pricing" },
    { label: "Docs", href: "/docs" },
  ];

  const scrollToSection = (href: string) => {
    if (href.startsWith("#")) {
      const element = document.querySelector(href);
      element?.scrollIntoView({ behavior: "smooth" });
      setMobileMenuOpen(false);
    } else {
      navigate(href);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
      {/* Navbar */}
      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolledPastHero ? "bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800 shadow-sm py-0" : "bg-transparent py-2"}`}>
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-6">
          {/* LEFT: Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 bg-gradient-to-br from-purple-700 to-violet-800 rounded-lg flex items-center justify-center shadow-lg shadow-purple-700/20 overflow-hidden">
              <img 
                src="/app_logo.png" 
                alt="EduGenie Logo" 
                className="h-8 w-8 object-cover brightness-0 invert"
              />
            </div>
            <span className={`font-bold text-xl tracking-tight transition-colors ${!isScrolledPastHero ? "text-white" : "text-gray-900 dark:text-white"}`}>EduGenie</span>
          </div>

          {/* CENTER: Navigation Links */}
          <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => scrollToSection(item.href)}
                className={`text-sm font-medium transition-colors hover:scale-105 active:scale-95 ${!isScrolledPastHero ? "text-gray-200 hover:text-white" : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className={`h-10 w-10 rounded-full hidden md:flex transition-colors ${!isScrolledPastHero ? "text-white hover:bg-white/10 hover:text-white" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800"}`}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            {isSignedIn ? (
              <Button
                onClick={() => navigate('/dashboard')}
                className="h-10 rounded-full px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/25 text-white hidden md:inline-flex font-medium transition-transform hover:scale-105"
              >
                Dashboard
              </Button>
            ) : (
              <>
                <SignInButton mode="modal" forceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard">
                  <Button
                    variant="ghost"
                    className={`h-10 px-4 hidden md:inline-flex rounded-full font-medium transition-colors ${!isScrolledPastHero ? "text-white hover:bg-white/10 hover:text-white" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800"}`}
                  >
                    Login
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal" forceRedirectUrl="/dashboard" signInForceRedirectUrl="/dashboard">
                  <Button
                    className="h-10 rounded-full px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/25 text-white hidden md:inline-flex font-medium transition-transform hover:scale-105"
                  >
                    Get Started
                  </Button>
                </SignUpButton>
              </>
            )}

            {/* Mobile: Theme Toggle + Hamburger */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className={`h-10 w-10 rounded-full md:hidden transition-colors ${!isScrolledPastHero ? "text-white hover:bg-white/10 hover:text-white" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800"}`}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <button
              className={`md:hidden h-10 w-10 inline-flex items-center justify-center rounded-full transition-colors ${!isScrolledPastHero ? "text-white hover:bg-white/10" : "text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="max-w-7xl mx-auto px-6 py-4 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => scrollToSection(item.href)}
                  className="block w-full text-left px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  {item.label}
                </button>
              ))}
              <div className="pt-4 space-y-2 border-t border-gray-200 dark:border-gray-800 mt-4">
                {isSignedIn ? (
                  <Button
                    className="w-full h-10 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/dashboard');
                    }}
                  >
                    Dashboard
                  </Button>
                ) : (
                  <>
                    <SignInButton mode="modal" forceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard">
                      <Button
                        variant="outline"
                        className="w-full h-10"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Login
                      </Button>
                    </SignInButton>
                    <SignUpButton mode="modal" forceRedirectUrl="/dashboard" signInForceRedirectUrl="/dashboard">
                      <Button
                        className="w-full h-10 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Get Started
                      </Button>
                    </SignUpButton>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <ScrollyTutor />

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Everything You Need To Excel</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">Powerful tools designed for serious learners</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={MessageSquare}
              title="AI Tutor"
              description="Get instant explanations and clarifications from an AI that understands your learning style"
            />
            <FeatureCard
              icon={FileText}
              title="MCQ Generator"
              description="Create unlimited practice questions from any topic or uploaded notes automatically"
            />
            <FeatureCard
              icon={Target}
              title="Mock Tests"
              description="Take timed practice exams with real-time scoring and detailed performance analytics"
            />
            <FeatureCard
              icon={Brain}
              title="Smart Notes"
              description="Upload and organize your study materials with AI-powered insights and summaries"
            />
            <FeatureCard
              icon={TrendingUp}
              title="Weak Topic Detection"
              description="Automatically identify areas that need improvement based on your performance"
            />
            <FeatureCard
              icon={Calendar}
              title="Revision Planner"
              description="Get personalized study schedules optimized for spaced repetition and retention"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">How EduGenie Works</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">Start learning smarter in three simple steps</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <StepCard
              number="1"
              title="Learn"
              description="Chat with AI tutor"
              detail="Ask questions and get detailed explanations tailored to your understanding level"
            />
            <StepCard
              number="2"
              title="Practice"
              description="Generate quizzes"
              detail="Create custom practice tests from any topic and track your performance over time"
            />
            <StepCard
              number="3"
              title="Improve"
              description="Get personalized plan"
              detail="Receive AI-powered recommendations to focus on weak areas and optimize learning"
            />
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">See It In Action</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">Explore the features that make learning effortless</p>
          </div>

          <Tabs defaultValue="chat" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="chat">Chat Demo</TabsTrigger>
              <TabsTrigger value="quiz">Quiz Demo</TabsTrigger>
              <TabsTrigger value="notes">Notes Demo</TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="mt-8">
              <Card>
                <CardContent className="p-8">
                  <div className="space-y-4">
                    <div className="bg-gray-100 p-4 rounded-lg">
                      <p className="font-medium">You: Explain photosynthesis</p>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-lg">
                      <p className="font-medium text-indigo-900">AI Tutor:</p>
                      <p className="text-gray-700 mt-2">Photosynthesis is the process by which plants convert light energy into chemical energy...</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quiz" className="mt-8">
              <Card>
                <CardContent className="p-8">
                  <div className="space-y-4">
                    <p className="font-bold text-lg">Question 1 of 10</p>
                    <p className="text-gray-700">What is the powerhouse of the cell?</p>
                    <div className="space-y-2">
                      <button className="w-full text-left p-3 border rounded hover:bg-gray-50">A) Nucleus</button>
                      <button className="w-full text-left p-3 border rounded hover:bg-gray-50">B) Mitochondria</button>
                      <button className="w-full text-left p-3 border rounded hover:bg-gray-50">C) Ribosome</button>
                      <button className="w-full text-left p-3 border rounded hover:bg-gray-50">D) Golgi apparatus</button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-8">
              <Card>
                <CardContent className="p-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg">Biology Chapter 3</h3>
                      <span className="text-sm text-gray-500">Uploaded 2 days ago</span>
                    </div>
                    <div className="prose">
                      <p className="text-gray-700">Key concepts:</p>
                      <ul className="list-disc pl-6 text-gray-600">
                        <li>Cell structure and function</li>
                        <li>Cellular respiration</li>
                        <li>Photosynthesis process</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-24 px-6 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Students Improve Faster</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">Real results from real students</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <MetricCard metric="2x" label="Faster Revision" />
            <MetricCard metric="40%" label="More Retention" />
            <MetricCard metric="100%" label="Daily Study Habit Built" />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="reviews" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Loved By Students</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">See what learners are saying</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <TestimonialCard
              name="Priya Sharma"
              role="JEE Aspirant"
              content="Finally I don't waste time making notes anymore. The AI tutor explains everything so clearly!"
              rating={5}
            />
            <TestimonialCard
              name="Rahul Kumar"
              role="NEET Student"
              content="The weak topic detection is a game changer. I know exactly what to focus on now."
              rating={5}
            />
            <TestimonialCard
              name="Ananya Gupta"
              role="CAT Preparation"
              content="Best study platform I've used. The quizzes adapt to my level perfectly."
              rating={5}
            />
            <TestimonialCard
              name="Arjun Patel"
              role="UPSC Aspirant"
              content="The revision planner helped me stay consistent. Can't imagine studying without it."
              rating={5}
            />
            <TestimonialCard
              name="Sneha Reddy"
              role="Engineering Student"
              content="This app made exam prep so much less stressful. Highly recommend!"
              rating={5}
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">Choose the plan that works for you</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <PricingCard
              name="Free"
              price="₹0"
              period="/month"
              features={[
                "50 MCQs per month",
                "Basic AI tutor",
                "3 mock tests",
                "Community support"
              ]}
              cta="Get Started"
            />
            <PricingCard
              name="Pro"
              price="₹49"
              period="/month"
              features={[
                "Unlimited MCQs",
                "Advanced AI tutor",
                "Unlimited mock tests",
                "Weak topic detection",
                "Priority support",
                "Custom study plans"
              ]}
              cta="Start Free Trial"
              popular
            />
            <PricingCard
              name="Student+"
              price="₹99"
              period="/month"
              features={[
                "Everything in Pro",
                "1-on-1 mentorship",
                "Exam-specific content",
                "Progress analytics",
                "PDF uploads",
                "Dedicated support"
              ]}
              cta="Get Started"
            />
          </div>

          <p className="text-center text-gray-600 dark:text-gray-400 mt-8">No credit card required • Cancel anytime</p>
        </div>
      </section>

      {/* Documentation */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Learn How To Use EduGenie</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">Comprehensive guides and tutorials</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <DocCard
              icon={BookOpen}
              title="Getting Started"
              description="Learn the basics and set up your account"
              href="/docs/getting-started"
            />
            <DocCard
              icon={MessageSquare}
              title="Using AI Tutor"
              description="Master the chat interface for better learning"
              href="/docs/ai-tutor"
            />
            <DocCard
              icon={FileText}
              title="Generating MCQs"
              description="Create effective practice questions"
              href="/docs/mcq-generator"
            />
            <DocCard
              icon={Target}
              title="Practicing Tests"
              description="Take mock exams and track progress"
              href="/docs/mock-tests"
            />
            <DocCard
              icon={Brain}
              title="Smart Notes"
              description="Organize and optimize your study materials"
              href="/docs/smart-notes"
            />
            <DocCard
              icon={Zap}
              title="Advanced Features"
              description="Unlock the full potential of EduGenie"
              href="/docs/advanced"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            <FAQItem
              question="Is the AI accurate?"
              answer="Yes! Our AI is trained on verified educational content and provides accurate, curriculum-aligned responses. It's continuously improved based on student feedback."
              expanded={expandedFaq === 0}
              onClick={() => setExpandedFaq(expandedFaq === 0 ? null : 0)}
            />
            <FAQItem
              question="Can I upload PDFs?"
              answer="Absolutely! You can upload PDFs, images, and text documents. Our AI will extract content and help you create study materials from them."
              expanded={expandedFaq === 1}
              onClick={() => setExpandedFaq(expandedFaq === 1 ? null : 1)}
            />
            <FAQItem
              question="Does it track progress?"
              answer="Yes! EduGenie provides detailed analytics showing your performance trends, weak topics, and improvement over time with visual dashboards."
              expanded={expandedFaq === 2}
              onClick={() => setExpandedFaq(expandedFaq === 2 ? null : 2)}
            />
            <FAQItem
              question="Is it really free?"
              answer="We offer a generous free tier with 50 MCQs per month and basic features. You can upgrade anytime for unlimited access and advanced features."
              expanded={expandedFaq === 3}
              onClick={() => setExpandedFaq(expandedFaq === 3 ? null : 3)}
            />
            <FAQItem
              question="Works on mobile?"
              answer="Yes! EduGenie is fully responsive and works seamlessly on all devices - desktop, tablet, and mobile. Study anytime, anywhere."
              expanded={expandedFaq === 4}
              onClick={() => setExpandedFaq(expandedFaq === 4 ? null : 4)}
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-12 text-white">
            <h2 className="text-4xl font-bold mb-4">Start Learning Smarter Today</h2>
            <p className="text-xl mb-8 opacity-90">
              Join thousands of students who are already acing their exams
            </p>
            {isSignedIn ? (
              <Button size="lg" variant="secondary" className="text-lg px-8 h-14" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            ) : (
              <SignUpButton mode="modal" forceRedirectUrl="/dashboard" signInForceRedirectUrl="/dashboard">
                <Button size="lg" variant="secondary" className="text-lg px-8 h-14">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </SignUpButton>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Product */}
            <div>
              <h3 className="text-white font-bold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><button onClick={() => scrollToSection('#features')} className="hover:text-white transition-colors">Features</button></li>
                <li><button onClick={() => scrollToSection('#pricing')} className="hover:text-white transition-colors">Pricing</button></li>
                <li><a href="#" className="hover:text-white transition-colors">Updates</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-white font-bold mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><button onClick={() => navigate('/docs')} className="hover:text-white transition-colors">Documentation</button></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Guides</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-white font-bold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
              </ul>
            </div>

            {/* Social */}
            <div>
              <h3 className="text-white font-bold mb-4">Social</h3>
              <div className="flex gap-4">
                <a href="#" className="hover:text-white transition-colors">
                  <Github className="h-5 w-5" />
                </a>
                <a href="#" className="hover:text-white transition-colors">
                  <Twitter className="h-5 w-5" />
                </a>
                <a href="#" className="hover:text-white transition-colors">
                  <Mail className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between">
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
            <p className="text-sm">&copy; {new Date().getFullYear()} EduGenie. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Component helpers
function FeatureCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-lg transition-all bg-white dark:bg-gray-800">
      <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description, detail }: { number: string; title: string; description: string; detail: string }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white text-2xl font-bold">
        {number}
      </div>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-lg text-indigo-600 dark:text-indigo-400 mb-3">{description}</p>
      <p className="text-gray-600 dark:text-gray-400">{detail}</p>
    </div>
  );
}

function MetricCard({ metric, label }: { metric: string; label: string }) {
  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardContent className="p-8 text-center">
        <p className="text-5xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">{metric}</p>
        <p className="text-gray-600 dark:text-gray-400">{label}</p>
      </CardContent>
    </Card>
  );
}

function TestimonialCard({ name, role, content, rating }: { name: string; role: string; content: string; rating: number }) {
  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardContent className="p-6">
        <div className="flex gap-1 mb-3">
          {Array.from({ length: rating }).map((_, i) => (
            <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          ))}
        </div>
        <p className="text-gray-700 dark:text-gray-300 mb-4">&ldquo;{content}&rdquo;</p>
        <div>
          <p className="font-bold text-gray-900 dark:text-white">{name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{role}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PricingCard({ name, price, period, features, cta, popular }: { name: string; price: string; period: string; features: string[]; cta: string; popular?: boolean }) {
  const navigate = useNavigate();

  return (
    <Card className={popular ? "border-indigo-600 shadow-xl scale-105 dark:border-indigo-500 dark:bg-gray-800" : "dark:bg-gray-800 dark:border-gray-700"}>
      <CardContent className="p-8">
        {popular && (
          <div className="text-center mb-4">
            <span className="inline-block px-4 py-1 bg-indigo-600 text-white text-sm font-semibold rounded-full">
              Most Popular
            </span>
          </div>
        )}
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{name}</h3>
        <div className="mb-6">
          <span className="text-5xl font-bold text-gray-900 dark:text-white">{price}</span>
          <span className="text-gray-600 dark:text-gray-400">{period}</span>
        </div>
        <ul className="space-y-3 mb-8">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-600 dark:text-gray-400">{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          className={`w-full ${popular ? 'bg-gradient-to-r from-indigo-600 to-violet-600' : ''}`}
          variant={popular ? 'default' : 'outline'}
          onClick={() => navigate('/sign-up')}
        >
          {cta}
        </Button>
      </CardContent>
    </Card>
  );
}

function DocCard({ icon: Icon, title, description, href }: { icon: any; title: string; description: string; href: string }) {
  const navigate = useNavigate();

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer dark:bg-gray-800 dark:border-gray-700" onClick={() => navigate(href)}>
      <CardContent className="p-6">
        <Icon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">{description}</p>
      </CardContent>
    </Card>
  );
}

function FAQItem({ question, answer, expanded, onClick }: { question: string; answer: string; expanded: boolean; onClick: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        onClick={onClick}
      >
        <span className="font-bold text-gray-900 dark:text-white">{question}</span>
        {expanded ? <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
      </button>
      {expanded && (
        <div className="px-6 pb-6">
          <p className="text-gray-600 dark:text-gray-400">{answer}</p>
        </div>
      )}
    </div>
  );
}
