# Component Visibility Test - Production

## Issue:
DebugPanel and UserSwitcher components work in localhost but don't appear in Vercel production.

## Verification Checklist:

### In Production (Vercel):
- [ ] Logged in with: naemmukhtar@gmail.com
- [ ] On homepage (not form pages)
- [ ] Hard refresh done (Ctrl+Shift+R)
- [ ] Browser console shows no errors
- [ ] Debug button visible at bottom-right
- [ ] UserSwitcher visible near top

### Environment Variables Check:
- [ ] NEXT_PUBLIC_SUPER_ADMIN_EMAIL is set in Vercel
- [ ] Value matches: naemmukhtar@gmail.com

### Build Verification:
- [ ] Latest deployment ID: ___________
- [ ] Deployment from commit: 5176ff8
- [ ] Build completed successfully
- [ ] No component-related errors in build log

## Diagnostic Steps:

### Step 1: Check if components are in the bundle
Add this to browser console in production:
```javascript
// Check if session exists
console.log('Session:', document.querySelector('button')?.textContent?.includes('Log Keluar'));

// Check if components loaded
console.log('DebugPanel in DOM:', !!document.querySelector('[class*="fixed bottom-4 right-4"]'));
console.log('UserSwitcher in DOM:', !!document.querySelector('button:has-text("Switch User View")'));
```

### Step 2: Force rebuild in Vercel
1. Go to Vercel Dashboard
2. Click on deployment
3. Click "Redeploy" button
4. Select "Use existing build cache: NO"
5. Force fresh build

### Step 3: Check React DevTools
1. Install React DevTools browser extension
2. Open it in production
3. Search for "DebugPanel" component
4. Search for "UserSwitcher" component
5. Check if they're rendered but hidden (display:none)

## Possible Causes:

1. **Build Cache Issue** ⚠️
   - Vercel using old cached build
   - Solution: Force redeploy without cache

2. **CSS/Styling Issue**
   - Components render but are hidden
   - Solution: Check with React DevTools

3. **Import Path Issue**
   - Wrong relative path in production
   - Solution: Check build warnings

4. **Session Not Available**
   - NextAuth session not working in production
   - Solution: Check auth configuration

5. **Conditional Rendering Issue**
   - Some condition blocking render
   - Solution: Add console.logs to check

## Next Steps:

If still not showing after force redeploy, we need to:
1. Add console.log debug statements
2. Check if session exists in production
3. Verify environment variables
4. Check if components are being tree-shaken out
