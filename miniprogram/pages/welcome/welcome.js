Page({
  onLoad() {
    const hasSeenWelcome = wx.getStorageSync('hasSeenWelcome')

    if (hasSeenWelcome) {
      wx.switchTab({
        url: '/pages/home/home'
      })
    }
  },

  goIndex() {
    wx.setStorageSync('hasSeenWelcome', true)

    wx.switchTab({
      url: '/pages/home/home'
    })
  }
})