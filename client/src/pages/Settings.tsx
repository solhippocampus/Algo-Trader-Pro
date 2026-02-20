import { useConfig, useUpdateConfig } from "@/hooks/use-bot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Save } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Matching schema from shared/schema partial
const settingsSchema = z.object({
  apiEnabled: z.boolean(),
  maxPositionSize: z.coerce.number().min(1).max(10000),
  stopLossPercentage: z.coerce.number().min(0.1).max(50),
  strategyWeights: z.object({
    marketMaking: z.coerce.number().min(0).max(1),
    arbitrage: z.coerce.number().min(0).max(1),
    momentum: z.coerce.number().min(0).max(1),
    bayes: z.coerce.number().min(0).max(1),
    rl: z.coerce.number().min(0).max(1),
  })
});

type SettingsForm = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { data: config, isLoading } = useConfig();
  const updateConfig = useUpdateConfig();
  const [strategyWeights, setStrategyWeights] = useState<Record<string, number>>({});

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      apiEnabled: false,
      maxPositionSize: 100,
      stopLossPercentage: 5,
      strategyWeights: {
        marketMaking: 0.2,
        arbitrage: 0.2,
        momentum: 0.2,
        bayes: 0.2,
        rl: 0.2
      }
    }
  });

  useEffect(() => {
    if (config) {
      form.reset({
        apiEnabled: config.apiEnabled,
        maxPositionSize: Number(config.maxPositionSize),
        stopLossPercentage: Number(config.stopLossPercentage),
        strategyWeights: config.strategyWeights as any
      });
      setStrategyWeights(config.strategyWeights as any);
    }
  }, [config, form]);

  const onSubmit = (data: SettingsForm) => {
    // Normalize weights to ensure they sum to 1 is a good practice, but for now we just save
    updateConfig.mutate({
      ...data,
      maxPositionSize: String(data.maxPositionSize),
      stopLossPercentage: String(data.stopLossPercentage)
    });
  };

  const handleWeightChange = (key: string, value: number) => {
    const newWeights = { ...strategyWeights, [key]: value };
    setStrategyWeights(newWeights);
    form.setValue(`strategyWeights.${key}` as any, value);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading settings...</div>;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 grid-bg">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-4 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-lg font-bold font-display">Bot Configuration</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          <Card className="glass-card border-white/5">
            <CardHeader>
              <CardTitle>Risk Management</CardTitle>
              <CardDescription>Control how much capital the bot can risk per trade.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Max Position Size (USDT)</Label>
                <div className="flex gap-4">
                  <Input 
                    type="number" 
                    {...form.register("maxPositionSize")} 
                    className="bg-white/5 border-white/10"
                  />
                  <div className="text-sm text-muted-foreground self-center">USDT</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Stop Loss Percentage</Label>
                  <span className="text-sm font-mono text-primary">{form.watch("stopLossPercentage")}%</span>
                </div>
                <Slider 
                  value={[form.watch("stopLossPercentage")]} 
                  min={0.5} 
                  max={20} 
                  step={0.5}
                  onValueChange={([val]) => form.setValue("stopLossPercentage", val)}
                  className="[&>.relative>.absolute]:bg-primary"
                />
              </div>

               <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="space-y-0.5">
                  <Label>Binance API Connection</Label>
                  <p className="text-sm text-muted-foreground">Allow bot to execute real orders</p>
                </div>
                <Switch 
                  checked={form.watch("apiEnabled")}
                  onCheckedChange={(checked) => form.setValue("apiEnabled", checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/5">
            <CardHeader>
              <CardTitle>Strategy Allocation</CardTitle>
              <CardDescription>Adjust the influence weight of each trading algorithm.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(strategyWeights).map(([key, value]) => (
                <div key={key} className="space-y-3">
                  <div className="flex justify-between capitalize">
                    <Label>{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
                    <span className="text-sm font-mono text-muted-foreground">{(value * 100).toFixed(0)}%</span>
                  </div>
                  <Slider 
                    value={[value]} 
                    min={0} 
                    max={1} 
                    step={0.05}
                    onValueChange={([val]) => handleWeightChange(key, val)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/">
              <Button variant="ghost" type="button">Cancel</Button>
            </Link>
            <Button 
              type="submit" 
              disabled={updateConfig.isPending}
              className="bg-primary hover:bg-primary/90 text-white min-w-[140px]"
            >
              {updateConfig.isPending ? "Saving..." : (
                <>
                  <Save className="w-4 h-4 mr-2" /> Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
