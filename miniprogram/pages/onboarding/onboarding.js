Page({
  data: {
    onboardingTags: ['项目经历', '活动记录', '旅行回忆', '申请材料']
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/add/add' })
  },

  showExampleRecord() {
    wx.navigateTo({ url: '/pages/example/example' })
  }
})