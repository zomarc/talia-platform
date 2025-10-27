# Talia Auth Testing Guide

## 🚀 **Quick Start**

**URL**: http://localhost:5173  
**Branch**: `feature-talia-auth`  
**Status**: ✅ **Authentication System Active**

## 🧪 **Testing Scenarios**

### **1. First-Time User (New Registration)**

1. **Open Browser**: Navigate to http://localhost:5173
2. **Expected**: See beautiful landing page with gradient background
3. **Enter Email**: Use any valid email (e.g., `test@example.com`)
4. **Click "Send Magic Code"**: Should show loading state
5. **Check Console**: Look for InstantDB connection logs
6. **Expected**: Step 2 - Code verification screen

### **2. Magic Code Verification**

1. **Enter 6-Digit Code**: Use any 6 digits (e.g., `123456`)
2. **Click "Verify Code"**: Should attempt verification
3. **Expected**: Either success (if code works) or error message
4. **Note**: InstantDB magic codes are real - check your email!

### **3. Successful Login**

1. **After Verification**: Should redirect to dashboard
2. **Expected**: See familiar Talia UI with sidebar
3. **Check User Profile**: Look for user avatar in sidebar bottom
4. **Expected**: User profile with role display

### **4. Role-Based Access Testing**

#### **Test as Guest User**
- **Expected Focuses**: Only "Performance Dashboard"
- **Missing Focuses**: Exception, Itinerary, Group, Promotion, Inventory, Setup

#### **Test as Manager User**
- **Expected Focuses**: Performance, Exception, Itinerary, Group, Promotion, Inventory
- **Missing Focuses**: Setup only

#### **Test as Admin User**
- **Expected Focuses**: All focuses including Setup

### **5. User Profile Testing**

1. **Click User Avatar**: Should expand profile dropdown
2. **Check User Info**: Email, role, preferences
3. **Test Quick Settings**: Change theme, font size
4. **Expected**: Changes should apply immediately
5. **Test Sign Out**: Should return to landing page

### **6. Existing Features Testing**

1. **Focus Navigation**: Switch between available focuses
2. **Panel Management**: Dock/undock windows
3. **Theme System**: Test all three themes
4. **Layout Persistence**: Save/load layouts
5. **Sidebar Resizing**: Drag to resize sidebar
6. **Data Tables**: Test Tabulator functionality
7. **Charts**: Test Chart.js functionality

## 🔍 **Debug Information**

### **Console Logs to Look For**
```
🚀 main.jsx loading
📦 React StrictMode: true
🎯 Root element: <div id="root">...</div>
🚀 App.jsx file loaded
📦 React version: 19.1.1
🔧 Dockview imported: true
```

### **Authentication Logs**
```
[AuthContext] User authenticated: {id: "...", email: "..."}
[AuthContext] User role: manager
[AuthContext] Preferences loaded: {...}
```

### **Focus Navigation Logs**
```
Focus changed to: performance
Loading focus layout: Performance Dashboard
Generated chart ID: chart-abc123...
```

## 🐛 **Common Issues & Solutions**

### **Issue: Blank White Page**
- **Check**: Console for JavaScript errors
- **Solution**: Refresh page, check network tab

### **Issue: Authentication Not Working**
- **Check**: InstantDB connection in console
- **Solution**: Verify project ID in `src/lib/db.js`

### **Issue: Focus Navigation Not Working**
- **Check**: User role in console
- **Solution**: Verify role-based filtering logic

### **Issue: Panels Not Loading**
- **Check**: Dockview API errors
- **Solution**: Check panel ID generation logic

## 📊 **Test Data**

### **Test Emails**
- `admin@talia.com` (should get admin role)
- `manager@talia.com` (should get manager role)
- `user@talia.com` (should get user role)
- `guest@talia.com` (should get guest role)

### **Test Magic Codes**
- Use any 6-digit code for testing
- Real codes will be sent to email addresses
- Check email for actual verification codes

## 🎯 **Success Criteria**

### **✅ Authentication Working**
- Landing page displays correctly
- Magic code flow works
- User profile shows in sidebar
- Sign out returns to landing page

### **✅ Role-Based Access Working**
- Different roles see different focuses
- Admin sees all focuses
- Guest sees only Performance
- Manager sees most focuses

### **✅ Existing Features Preserved**
- All Dockview functionality works
- Theme system works
- Layout persistence works
- Data tables and charts work

### **✅ User Experience Smooth**
- No console errors
- Smooth transitions
- Responsive design
- Fast loading

## 🚀 **Next Steps After Testing**

1. **Report Issues**: Note any problems or unexpected behavior
2. **Test Different Roles**: Try various user types
3. **Test Edge Cases**: Invalid emails, wrong codes, etc.
4. **Performance Check**: Ensure smooth operation
5. **Ready for Production**: Once all tests pass

---

**Happy Testing! 🎉**

The authentication system is now fully integrated with your existing Talia UI. You should see a beautiful landing page, smooth authentication flow, and all your existing features working with role-based access control.
