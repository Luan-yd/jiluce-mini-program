const share = require('./utils/share')
const originalPage = Page

Page = function(config) {
  const pageConfig = config || {}
  const originalOnLoad = pageConfig.onLoad

  pageConfig.onLoad = function(options) {
    const safeOptions = options || {}

    this.__shareOptions = safeOptions
    share.showShareMenu()

    if (share.shouldRedirectShareLanding(this, safeOptions)) {
      share.redirectShareLanding(this)
      return
    }

    if (typeof originalOnLoad === 'function') {
      return originalOnLoad.call(this, safeOptions)
    }
  }

  if (typeof pageConfig.onShareAppMessage !== 'function') {
    pageConfig.onShareAppMessage = function() {
      return share.defaultShareAppMessage(this)
    }
  }

  if (typeof pageConfig.onShareTimeline !== 'function') {
    pageConfig.onShareTimeline = function() {
      return share.defaultShareTimeline(this)
    }
  }

  if (typeof pageConfig.copyShareLink !== 'function') {
    pageConfig.copyShareLink = function() {
      return share.copyShareLink(this)
    }
  }

  return originalPage(pageConfig)
}

App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-d1gp6vbes53c12bc2',
        traceUser: true,
      })
    }
    this.globalData = {}
  },
  globalData: {}
})
