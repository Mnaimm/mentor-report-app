// pages/api/test-env.js - Test environment variables
export default async function handler(req, res) {
  try {
    const appsScriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
    
    res.status(200).json({
      message: "Environment variable test",
      hasAppsScriptUrl: !!appsScriptUrl,
      urlLength: appsScriptUrl?.length || 0,
      urlPreview: appsScriptUrl ? `${appsScriptUrl.substring(0, 50)}...` : 'NOT SET',
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('APPS_SCRIPT'))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}