import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Save, TestTube, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Mock settings data - in real app would come from API
  const settings = {
    metaAds: {
      connected: true,
      accountId: 'act_123456789',
    },
    notificationChannel: {
      primary: 'email',
      backup: false,
    },
    retryPolicy: {
      attempts: 3,
      waitMinutes: 5,
    },
    timezone: 'America/Argentina/Buenos_Aires',
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTestConnection = (channel: string) => {
    // Would trigger actual test in real app
    alert(`Testing ${channel} connection...`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure operational parameters and integrations
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save settings'}
        </Button>
      </div>

      {saveSuccess && (
        <AlertBanner variant="info" title="Settings updated successfully" message="Your configuration has been saved.">
        </AlertBanner>
      )}

      {/* Settings Modules */}
      <div className="grid gap-6">
        {/* Meta Ads Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Meta Ads Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Account ID</p>
                <p className="text-sm text-muted-foreground font-mono">{settings.metaAds.accountId}</p>
              </div>
              <div className="flex items-center gap-2">
                {settings.metaAds.connected ? (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" /> Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-red-600">
                    <XCircle className="w-4 h-4" /> Disconnected
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleTestConnection('Meta Ads')}>
              <TestTube className="mr-2 h-4 w-4" />
              Test connection
            </Button>
          </CardContent>
        </Card>

        {/* Notification Channels */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Channels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Primary Channel</p>
                <p className="text-sm text-muted-foreground capitalize">{settings.notificationChannel.primary}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleTestConnection('email')}>
                <TestTube className="mr-2 h-4 w-4" />
                Test
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Backup Channel</p>
                <p className="text-sm text-muted-foreground">
                  {settings.notificationChannel.backup ? 'Enabled' : 'Disabled (off by default)'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Retry Policy */}
        <Card>
          <CardHeader>
            <CardTitle>Retry Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <RefreshCwIcon className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{settings.retryPolicy.attempts} attempts</p>
                  <p className="text-xs text-muted-foreground">Max retries</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{settings.retryPolicy.waitMinutes} minutes</p>
                  <p className="text-xs text-muted-foreground">Wait between retries</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timezone */}
        <Card>
          <CardHeader>
            <CardTitle>Timezone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <span className="font-mono text-sm">{settings.timezone}</span>
              <span className="text-xs text-muted-foreground">(read-only)</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RefreshCwIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor" 
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}