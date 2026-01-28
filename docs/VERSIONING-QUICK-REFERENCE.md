# Talia Versioning - Quick Reference Card

## 🎯 **Core Strategy**
**Development-first versioning with a clear production threshold**

## 📋 **Format: x.y.z**

### **x (Major) - Production Level**
| Version | Status | Audience | Purpose |
|---------|--------|----------|---------|
| **0.x.x** | Development | Internal/Review | Dev baselines |
| **1.x.x** | Production | End users | Live operation |
| **2.x.x** | Enterprise | Enterprise | Advanced features |

### **y (Minor) - Baseline / Feature Releases**
- **0.y.0** = Baseline or major feature release
- **0.y.z** = Testable dev iterations

### **z (Patch) - Testable Dev Releases**
- **0.y.1, 0.y.2, ...** = Testable dev iterations

## 🚀 **Current Status**

### **v0.1.0 - Dev Baseline** ✅
- **Status**: Dev baseline, review-ready
- **Features**: Core revenue and inventory management
- **Next**: v0.2.0 (Enhanced data features)

### **Upcoming Releases**
- **v0.2.0** - Enhanced data features
- **v0.3.0** - Focus management implementation
- **v0.4.0** - Real-time features and subscriptions
- **v1.0.0** - First production release

## ✅ **Quality Gates**

### **Dev Baseline (v0.x.x)**
- ✅ All core features working
- ✅ Comprehensive documentation
- ✅ Review-ready
- ✅ Development environment setup

### **Production Ready (v1.x.x)**
- ✅ Production deployment successful
- ✅ Performance benchmarks met
- ✅ Security audit completed
- ✅ Monitoring and alerting

## 🎮 **Demonstration Guidelines**

- **v0.x.x**: Internal + external review
- **v1.x.x**: End users, customers
- **v2.x.x**: Enterprise customers

## 🔧 **Quick Commands**

```bash
# Check current version
git tag -l | grep v0

# Create feature branch
git checkout -b feature/focus-management

# Tag new version
git tag -a v0.3.0 -m "Focus management implementation"

# View version history
git log --oneline --decorate
```

---

**📋 Full Strategy**: See [VERSIONING-STRATEGY.md](./VERSIONING-STRATEGY.md) for complete details

**🎯 Key Principle**: *"All development baselines are 0.y.z; production begins at 1.x.x."*
