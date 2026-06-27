import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Code2, Copy, Check, Bot, Globe, Zap, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function EmbedCode() {
  const { data: agents } = trpc.agent.list.useQuery();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);

  const selectedAgent = agents?.find((a) => String(a.id) === selectedAgentId);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-chatbotpro-domain.com";

  const scriptTag = selectedAgent
    ? `<!-- ChatBot Pro Widget -->
<script>
  window.ChatBotProConfig = {
    agentId: "${selectedAgent.id}",
    color: "${selectedAgent.widgetColor ?? "#6366f1"}",
    position: "${selectedAgent.widgetPosition ?? "bottom-right"}",
    size: "${selectedAgent.widgetSize ?? "standard"}",
    theme: "${selectedAgent.widgetTheme ?? "light"}",
    apiBase: "${origin}/api",
  };
</script>
<script
  src="${origin}/widget/embed.js"
  async
  defer
></script>`
    : `<!-- Select an agent above to generate your embed code -->`;

  const npmSnippet = selectedAgent
    ? `import { ChatBotProWidget } from "@chatbotpro/react";

export default function App() {
  return (
    <>
      {/* Your app content */}
      <ChatBotProWidget
        agentId="${selectedAgent.id}"
        color="${selectedAgent.widgetColor ?? "#6366f1"}"
        position="${selectedAgent.widgetPosition ?? "bottom-right"}"
        theme="${selectedAgent.widgetTheme ?? "light"}"
      />
    </>
  );
}`
    : `// Select an agent above to generate your React snippet`;

  const wordpressSnippet = selectedAgent
    ? `// Add to your WordPress theme's functions.php
function chatbotpro_widget() {
    ?>
    <script>
      window.ChatBotProConfig = {
        agentId: "<?php echo esc_js('${selectedAgent.id}'); ?>",
        color: "<?php echo esc_js('${selectedAgent.widgetColor ?? "#6366f1"}'); ?>",
        position: "<?php echo esc_js('${selectedAgent.widgetPosition ?? "bottom-right"}'); ?>",
        theme: "<?php echo esc_js('${selectedAgent.widgetTheme ?? "light"}'); ?>",
        apiBase: "${origin}/api",
      };
    </script>
    <script src="${origin}/widget/embed.js" async defer></script>
    <?php
}
add_action('wp_footer', 'chatbotpro_widget');`
    : `// Select an agent above to generate your WordPress snippet`;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Widget Embed Code</h1>
        <p className="text-muted-foreground text-sm mt-1">Get the code snippet to add your AI agent widget to any website</p>
      </div>

      {/* Agent Selector */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Select Agent</CardTitle>
          <CardDescription className="text-xs">Choose which AI agent to generate the embed code for</CardDescription>
        </CardHeader>
        <CardContent>
          {!agents || agents.length === 0 ? (
            <div className="text-center py-6">
              <Bot className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No agents found. Create an agent first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={String(agent.id)}>
                      <div className="flex items-center gap-2">
                        <Bot className="w-3.5 h-3.5 text-primary" />
                        <span>{agent.name}</span>
                        {agent.isActive ? (
                          <Badge className="text-xs bg-green-500/10 text-green-600 border-green-200 ml-1">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs ml-1">Inactive</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedAgent && (
                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedAgent.widgetColor ?? "#6366f1" }} />
                    <span>Color: {selectedAgent.widgetColor ?? "#6366f1"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3 h-3" />
                    <span>Position: {selectedAgent.widgetPosition ?? "bottom-right"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3" />
                    <span>Mode: {(selectedAgent.handoffMode ?? "ai_only").replace(/_/g, " ")}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Code Snippets */}
      <Tabs defaultValue="html">
        <TabsList>
          <TabsTrigger value="html" className="gap-1.5 text-xs"><Code2 className="w-3.5 h-3.5" />HTML / Script Tag</TabsTrigger>
          <TabsTrigger value="react" className="gap-1.5 text-xs"><Code2 className="w-3.5 h-3.5" />React / Next.js</TabsTrigger>
          <TabsTrigger value="wordpress" className="gap-1.5 text-xs"><Code2 className="w-3.5 h-3.5" />WordPress</TabsTrigger>
        </TabsList>

        {[
          { key: "html", label: "HTML", code: scriptTag, description: "Paste this snippet before the </body> tag of your HTML page." },
          { key: "react", label: "React", code: npmSnippet, description: "Install the @chatbotpro/react package and add the component to your app." },
          { key: "wordpress", label: "WordPress", code: wordpressSnippet, description: "Add this to your theme's functions.php file." },
        ].map(({ key, label, code, description }) => (
          <TabsContent key={key} value={key} className="mt-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">{label} Embed Code</CardTitle>
                    <CardDescription className="text-xs mt-1">{description}</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => handleCopy(code, key)}
                    disabled={!selectedAgent}
                  >
                    {copied === key ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === key ? "Copied!" : "Copy Code"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className={cn(
                    "p-4 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed",
                    "bg-slate-950 text-slate-100 dark:bg-slate-900"
                  )}>
                    <code>{code}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Installation Steps */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Installation Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { step: "1", title: "Select your agent", desc: "Choose the AI agent you want to embed on your website from the dropdown above." },
              { step: "2", title: "Copy the code", desc: "Copy the embed snippet for your platform (HTML, React, or WordPress)." },
              { step: "3", title: "Paste into your website", desc: "Add the snippet to your website's HTML, component, or theme file as instructed." },
              { step: "4", title: "Test the widget", desc: "Visit your website and verify the chat widget appears and responds correctly." },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
