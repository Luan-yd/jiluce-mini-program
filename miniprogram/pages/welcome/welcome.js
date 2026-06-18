function hasCreatedFirstRecord() {
  const storedValue = wx.getStorageSync('hasCreatedFirstRecord')
  const records = wx.getStorageSync('records') || []
  const hasRecords = Array.isArray(records) && records.length > 0

  if (hasRecords && !storedValue) {
    wx.setStorageSync('hasCreatedFirstRecord', true)
  }

  return Boolean(storedValue || hasRecords)
}

function goNextPage() {
  if (hasCreatedFirstRecord()) {
    wx.switchTab({ url: '/pages/home/home' })
    return
  }

  wx.redirectTo({ url: '/pages/onboarding/onboarding' })
}

Page({
  onLoad() {
    const hasSeenWelcome = wx.getStorageSync('hasSeenWelcome')

    if (hasSeenWelcome) {
      goNextPage()
    }
  },

  goIndex() {
    wx.setStorageSync('hasSeenWelcome', true)
    goNextPage()
  }
})