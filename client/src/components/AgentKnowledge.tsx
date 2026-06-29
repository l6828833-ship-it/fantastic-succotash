import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  BookOpen, Plus, Search, Edit2, Trash2, FileText, MessageSquare, HelpCircle, Globe, Loader2, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const CATEGORIES = ["general", "billing", "technical", "onboarding", "policies", "faq"];

interface AgentKnowledgeProps {
  /** The agent these knowledge items belong to. New items are scoped to it. */
  agentId: number;
  /** Whether "Learn from website" is available on the current plan (Starter+). */
  canLearnFromWebsite: boolean;
}

/**
 * Per-agent knowledge manager embedded in the Agent settings page.
 * Lets the user add articles, Q&A pairs, and learn-from-website content that
 * are attached directly to this agent (the AI uses these + any shared items).
 */
export default function AgentKnowledge({ agentId, canLearnFromWebsite }: AgentKnowledgeProps) {
  const [search, setSearch] = useState("");

  // Article form state
  const [articleOpen, setArticleOpen] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<number | null>(null);
  const [articleTitle, setArticleTitle] = useState("");
  const [articleContent, setArticleContent] = useState("");
  const [articleCategory, setArticleCategory] = useState("general");

  // Q&A form state
  const [qaOpen, setQaOpen] = useState(false);
  const [editingQaId, setEditingQaId] = useState<number | null>(null);
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");

  // Website import
  const [websiteOpen, setWebsiteOpen] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");

  // Queries scoped to this agent (returns its own + shared workspace items)
  const { data: articles, refetch: refetchArticles } = trpc.knowledge.listArticles.useQuery({ agentId });
  const { data: qaPairs, refetch: refetchQA } = trpc.knowledge.listQA.useQuery({ agentId });

  const createArticle = trpc.knowledge.createArticle.useMutation({
    onSuccess: () => { refetchArticles(); setArticleOpen(false); resetArticleForm(); toast.success("Article added to this agent"); },
    onError: () => toast.error("Failed to create article"),
  });
  const updateArticle = trpc.knowledge.updateArticle.useMutation({
    onSuccess: () => { refetchArticles(); setArticleOpen(false); resetArticleForm(); toast.success("Article updated"); },
    onError: () => toast.error("Failed to update article"),
  });
  const deleteArticle = trpc.knowledge.deleteArticle.useMutation({
    onSuccess: () => { refetchArticles(); toast.success("Article deleted"); },
    onError: () => toast.error("Failed to delete article"),
  });
  const createQA = trpc.knowledge.createQA.useMutation({
    onSuccess: () => { refetchQA(); setQaOpen(false); resetQAForm(); toast.success("Q&A added to this agent"); },
    onError: () => toast.error("Failed to add Q&A pair"),
  });
  const updateQA = trpc.knowledge.updateQA.useMutation({
    onSuccess: () => { refetchQA(); setQaOpen(false); resetQAForm(); toast.success("Q&A updated"); },
    onError: () => toast.error("Failed to update Q&A"),
  });
  const deleteQA = trpc.knowledge.deleteQA.useMutation({
    onSuccess: () => { refetchQA(); toast.success("Q&A deleted"); },
    onError: () => toast.error("Failed to delete Q&A"),
  });
  const importFromUrl = trpc.knowledge.importFromUrl.useMutation({
    onSuccess: () => { refetchArticles(); setWebsiteOpen(false); setWebsiteUrl(""); toast.success("Website content learned"); },
    onError: (e) => toast.error(e.message || "Failed to import from website"),
  });

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
      createArticle.mutate({ title: articleTitle, content: articleContent, category: articleCategory, agentId });
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
      createQA.mutate({ question: qaQuestion, answer: qaAnswer, agentId });
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

  const isShared = (itemAgentId?: number | null) => itemAgentId == null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Knowledge for this agent</p>
          <p className="text-xs text-muted-foreground">Articles, Q&A and website content this agent uses to answer accurately. The more you add, the smarter it gets.</p>
        </div>
        <Dialog open={websiteOpen} onOpenChange={(v) => { setWebsiteOpen(v); if (!v) setWebsiteUrl(""); }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 shrink-0">
              {canLearnFromWebsite ? <Globe className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
              Learn from website
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Learn from a website</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                We'll fetch the page, extract its text, and save it as an article for this agent so the AI can use it.
                {!canLearnFromWebsite && " This feature is available on the Starter plan and above."}
              </p>
              <div className="space-y-2">
                <Label>Website URL</Label>
                <Input placeholder="https://example.com/about" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
              </div>
              <Button
                className="w-full gap-2"
                disabled={importFromUrl.isPending || !websiteUrl.trim()}
                onClick={() => {
                  let url = websiteUrl.trim();
                  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
                  importFromUrl.mutate({ url, agentId });
                }}
              >
                {importFromUrl.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Importing…</> : <><Globe className="w-4 h-4" />Import content</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search this agent's knowledge..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs defaultValue="articles">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="articles" className="gap-1.5"><FileText className="w-3.5 h-3.5" />Articles ({articles?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="qa" className="gap-1.5"><HelpCircle className="w-3.5 h-3.5" />Q&A ({qaPairs?.length ?? 0})</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <TabsContent value="articles" className="mt-0">
              <Dialog open={articleOpen} onOpenChange={(v) => { setArticleOpen(v); if (!v) resetArticleForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />New Article</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{editingArticleId ? "Edit Article" : "New Article"}</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={articleCategory} onValueChange={setArticleCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input placeholder="Article title" value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Content</Label>
                      <Textarea placeholder="Write the article content here..." value={articleContent} onChange={(e) => setArticleContent(e.target.value)} rows={8} className="resize-y max-h-[45vh] overflow-y-auto" />
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
                  <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Add Q&A</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{editingQaId ? "Edit Q&A Pair" : "New Q&A Pair"}</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Question</Label>
                      <Input placeholder="e.g. How do I reset my password?" value={qaQuestion} onChange={(e) => setQaQuestion(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Answer</Label>
                      <Textarea placeholder="Write the answer here..." value={qaAnswer} onChange={(e) => setQaAnswer(e.target.value)} rows={5} className="resize-y max-h-[45vh] overflow-y-auto" />
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

        {/* Articles list */}
        <TabsContent value="articles" className="mt-4">
          {filteredArticles.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">No articles yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Add articles so this agent can answer accurately.</p>
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
                            {isShared((article as { agentId?: number | null }).agentId) && (
                              <Badge variant="secondary" className="text-xs">Shared</Badge>
                            )}
                            {(article as { sourceUrl?: string | null }).sourceUrl && (
                              <Badge variant="outline" className="text-xs gap-1"><Globe className="w-3 h-3" />Website</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{article.content}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleEditArticle({ id: article.id, title: article.title, content: article.content ?? '', category: article.category })}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this article?")) deleteArticle.mutate({ id: article.id }); }}>
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

        {/* Q&A list */}
        <TabsContent value="qa" className="mt-4">
          {filteredQA.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">No Q&A pairs yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Add question-answer pairs for common customer questions.</p>
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
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-medium text-foreground text-sm">{qa.question}</p>
                            {isShared((qa as { agentId?: number | null }).agentId) && (
                              <Badge variant="secondary" className="text-xs">Shared</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{qa.answer}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleEditQA({ id: qa.id, question: qa.question, answer: qa.answer })}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this Q&A pair?")) deleteQA.mutate({ id: qa.id }); }}>
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
