# Talia Versioning - Quick Reference Card

## 🎯 **Core Strategy**
**Stability-driven versioning for development-stage projects requiring demonstrable artifacts**

## 📋 **Format: x.y.z**

### **x (Major) - Stability Level**
| Version | Status | Audience | Purpose |
|---------|--------|----------|---------|
| **1.x.x** | Experimental | Dev team | Proof-of-concept |
| **2.x.x** | **Stable/Demonstrable** | **Stakeholders** | **Feature demos** ✅ **CURRENT** |
| **3.x.x** | Production Ready | End users | Live operation |
| **4.x.x** | Enterprise | Enterprise | Advanced features |

### **y (Minor) - Feature Branches**
- **x.0.x** = Baseline for stability level
- **x.1.x** = First major feature set
- **x.2.x** = Second major feature set
- etc.

### **z (Patch) - Iterations**
- **x.y.0** = Initial feature implementation
- **x.y.1** = Bug fixes and refinements
- **x.y.2** = Minor enhancements
- etc.

## 🚀 **Current Status**

### **v2.0.0 - Stable/Demonstrable Baseline** ✅
- **Status**: Stable, demonstrable, stakeholder-ready
- **Features**: Enhanced dual-project with GraphQL
- **Next**: v2.1.0 (Focus Management)

### **Upcoming Releases**
- **v2.1.0** - Focus management implementation
- **v2.2.0** - Real-time features and subscriptions
- **v3.0.0** - Production-ready deployment

## ✅ **Quality Gates**

### **Stable/Demonstrable (v2.x.x)**
- ✅ All core features working
- ✅ Comprehensive documentation
- ✅ Stakeholder demonstration ready
- ✅ Development environment setup

### **Production Ready (v3.x.x)**
- ✅ Production deployment successful
- ✅ Performance benchmarks met
- ✅ Security audit completed
- ✅ Monitoring and alerting

## 🎮 **Demonstration Guidelines**

- **v1.x.x**: Development team only
- **v2.x.x**: Stakeholders, management ✅ **CURRENT**
- **v3.x.x**: End users, customers
- **v4.x.x**: Enterprise customers

## 🔧 **Quick Commands**

```bash
# Check current version
git tag -l | grep v2

# Create feature branch
git checkout -b feature/focus-management

# Tag new version
git tag -a v2.1.0 -m "Focus management implementation"

# View version history
git log --oneline --decorate
```

---

**📋 Full Strategy**: See [VERSIONING-STRATEGY.md](./VERSIONING-STRATEGY.md) for complete details

**🎯 Key Principle**: *"Every major version (x.0.0) represents a stable, confirmed, deployable baseline that can be demonstrated to stakeholders with confidence."*
