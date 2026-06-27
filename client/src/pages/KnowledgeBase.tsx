import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { BookOpen, Plus, Search, Edit2, Trash2, FileText, CheckCircle2, MessageSquare, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const CATEGORIES = ["general", "billing", "technical", "onboarding", "policies", "faq"];

export default function KnowledgeBase() {
  // ── Articles state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [articleOpen, setArticleOpen] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<number | null>(null);
  const [articleTitle, setArticleTitle] = useState("");
  const [articleContent, setArticleContent] = useState("");
  const [articleCategory, setArticleCategory] = useState("general");

  // ── Q&A state ───────────────────────────────────────────────────────────────
  const [qaOpen, setQaOpen] = useState(false);
  const [editingQaId, setEditingQaId] = useState<number | null>(null);
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: articles, refetch: refetchArticles } = trpc.knowledge.listArticles.useQuery();
  const { data: qaPairs, refetch: refetchQA } = trpc.knowledge.listQA.useQuery();

  // ── Article mutations ────────────────────────────────────────────────────────
  const createArticle = trpc.knowledge.createArticle.useMutation({
    onSuccess: () => { refetchArticles(); setArticleOpen(false); resetArticleForm(); toast.success("Article created!"); },
    onError: () => toast.error("Failed to create article"),
  });
  const updateArticle = trpc.knowledge.updateArticle.useMutation({
    onSuccess: () => { refetchArticles(); setArticleOpen(false); resetArticleForm(); toast.success("Article updated!"); },
    onError: () => toast.error("Failed to update article"),
  });
  const deleteArticle = trpc.knowledge.deleteArticle.useMutation({
    onSuccess: () => { refetchArticles(); toast.success("Article deleted"); },
    onError: () => toast.error("Failed to delete article"),
  });

  // ── Q&A mutations ─────────────────────────────────────────────────────────────
  const createQA = trpc.knowledge.createQA.useMutation({
    onSuccess: () => { refetchQA(); setQaOpen(false); resetQAForm(); toast.success("Q&A pair added!"); },
    onError: () => toast.error("Failed to add Q&A pair"),
  });
  const updateQA = trpc.knowledge.updateQA.useMutation({
    onSuccess: () => { refetchQA(); setQaOpen(false); resetQAForm(); toast.success("Q&A updated!"); },
    onError: () => toast.error("Failed to update Q&A"),
  });
  const deleteQA = trpc.knowledge.deleteQA.useMutation({
    onSuccess: () => { refetchQA(); toast.success("Q&A deleted"); },
    onError: () => toast.error("Failed to delete Q&A"),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const resetArticleForm = () => { setArticleTitle(""); setArticleContent(""); setArticleCategory("general"); setEditingArticleId(null); };
  const resetQAForm = () => { setQaQuestion(""); setQaAnswer(""); setEditingQaId(null); };

  const handleEditArticle = (a: { id: number; title: string; content: string; category: string | null }) => {
    setEditingArticleId(a.id);
    setArticleTitle(a.title);
    setArticleContent(a.content);
    setArticleCategory(a.category ?? "general");
    setArticleOpen(true);
  };

  const handleSaveArticle = () => {
    if (!articleTitle.trim() || !articleContent.trim()) { toast.error("Title and content are required"); return; }
    if (editingArticleId) {
      updateArticle.mutate({ id: editingArticleId, title: articleTitle, content: articleContent, category: articleCategory });
    } else {
      createArticle.mutate({ title: articleTitle, content: articleContent, category: articleCategory });
    }
  };

  const handleEditQA = (qa: { id: number; question: string; answer: string }) => {
    setEditingQaId(qa.id);
    setQaQuestion(qa.question);
    setQaAnswer(qa.answer);
    setQaOpen(true);
  };

  const handleSaveQA = () => {
    if (!qaQuestion.trim() || !qaAnswer.trim()) { toast.error("Question and answer are required"); return; }
    if (editingQaId) {
      updateQA.mutate({ id: editingQaId, question: qaQuestion, answer: qaAnswer });
    } else {
      createQA.mutate({ question: qaQuestion, answer: qaAnswer });
    }
  };

  const filteredArticles = articles?.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.content ?? "").toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const filteredQA = qaPairs?.filter((q) =>
    q.question.toLowerCase().includes(search.toLowerCase()) ||
    q.answer.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
          <p className="text-muted-foreground text-sm mt-1">Articles and Q&A pairs your AI agent uses to answer questions accurately</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Articles", value: articles?.length ?? 0, icon: FileText, color: "text-blue-600 bg-blue-500/10" },
          { label: "Q&A Pairs", value: qaPairs?.length ?? 0, icon: HelpCircle, color: "text-purple-600 bg-purple-500/10" },
          { label: "Published", value: (articles?.length ?? 0) + (qaPairs?.length ?? 0), icon: CheckCircle2, color: "text-green-600 bg-green-500/10" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", stat.color)}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search articles and Q&A pairs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="articles">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="articles" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Articles ({articles?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="qa" className="gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              Q&A Pairs ({qaPairs?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <TabsContent value="articles" className="mt-0">
              <Dialog open={articleOpen} onOpenChange={(v) => { setArticleOpen(v); if (!v) resetArticleForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />New Article</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingArticleId ? "Edit Article" : "New Article"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={articleCategory} onValueChange={setArticleCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input placeholder="Article title" value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Content</Label>
                      <Textarea
                        placeholder="Write the article content here..."
                        value={articleContent}
                        onChange={(e) => setArticleContent(e.target.value)}
                        rows={8}
                        className="resize-y max-h-[45vh] overflow-y-auto"
                      />
                    </div>
                    <Button className="w-full" onClick={handleSaveArticle} disabled={createArticle.isPending || updateArticle.isPending}>
                      {createArticle.isPending || updateArticle.isPending ? "Saving..." : editingArticleId ? "Update Article" : "Create Article"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="qa" className="mt-0">
              <Dialog open={qaOpen} onOpenChange={(v) => { setQaOpen(v); if (!v) resetQAForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Add Q&A Pair</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingQaId ? "Edit Q&A Pair" : "New Q&A Pair"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Question</Label>
                      <Input placeholder="e.g. How do I reset my password?" value={qaQuestion} onChange={(e) => setQaQuestion(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Answer</Label>
                      <Textarea
                        placeholder="Write the answer here..."
                        value={qaAnswer}
                        onChange={(e) => setQaAnswer(e.target.value)}
                        rows={5}
                        className="resize-y max-h-[45vh] overflow-y-auto"
                      />
                    </div>
                    <Button className="w-full" onClick={handleSaveQA} disabled={createQA.isPending || updateQA.isPending}>
                      {createQA.isPending || updateQA.isPending ? "Saving..." : editingQaId ? "Update Q&A" : "Add Q&A Pair"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>
          </div>
        </div>

        {/* Articles Tab */}
        <TabsContent value="articles" className="mt-4">
          {filteredArticles.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No articles yet</h3>
              <p className="text-muted-foreground text-sm mb-6">Create articles to help your AI agent answer customer questions accurately.</p>
              <Button onClick={() => setArticleOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Create First Article</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredArticles.map((article) => (
                <Card key={article.id} className="border-border hover:border-primary/40 transition-all group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-blue-500/10 text-blue-600">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-medium text-foreground text-sm">{article.title}</p>
                            <Badge variant="outline" className="text-xs capitalize">{article.category ?? "general"}</Badge>
                            <Badge className="text-xs bg-green-500/10 text-green-600 border-green-200">Ready</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{article.content}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost" size="icon" className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleEditArticle({ id: article.id, title: article.title, content: article.content ?? '', category: article.category })}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={() => { if (confirm("Delete this article?")) deleteArticle.mutate({ id: article.id }); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Q&A Tab */}
        <TabsContent value="qa" className="mt-4">
          {filteredQA.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Q&A pairs yet</h3>
              <p className="text-muted-foreground text-sm mb-6">Add question-answer pairs to train your AI agent on common customer questions.</p>
              <Button onClick={() => setQaOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Add First Q&A Pair</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQA.map((qa) => (
                <Card key={qa.id} className="border-border hover:border-primary/40 transition-all group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-purple-500/10 text-purple-600">
                          <HelpCircle className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm mb-1">{qa.question}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{qa.answer}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost" size="icon" className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleEditQA({ id: qa.id, question: qa.question, answer: qa.answer })}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={() => { if (confirm("Delete this Q&A pair?")) deleteQA.mutate({ id: qa.id }); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
