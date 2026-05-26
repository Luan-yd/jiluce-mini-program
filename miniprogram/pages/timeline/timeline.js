Page({
    data: {
      groups: []
    },
  
    onShow() {
      this.loadTimeline()
    },
  
    loadTimeline() {
      const records = wx.getStorageSync('records') || []
  
      const sortedRecords = [...records].sort((a, b) => {
        return new Date(b.date) - new Date(a.date)
      })
  
      const groupMap = {}
  
      sortedRecords.forEach(record => {
        const date = record.date || ''
        const monthKey = this.getMonthKey(date)
  
        if (!groupMap[monthKey]) {
          groupMap[monthKey] = []
        }
  
        groupMap[monthKey].push(record)
      })
  
      const groups = Object.keys(groupMap).map(month => ({
        month,
        records: groupMap[month]
      }))
  
      this.setData({
        groups
      })
    },
  
    getMonthKey(dateString) {
      if (!dateString) {
        return '未填写日期'
      }
  
      const parts = dateString.split('-')
  
      if (parts.length < 2) {
        return '未填写日期'
      }
  
      const year = parts[0]
      const month = Number(parts[1])
  
      return `${year}年${month}月`
    },
  
    goDetail(e) {
      const id = e.currentTarget.dataset.id
  
      wx.navigateTo({
        url: `/pages/detail/detail?id=${id}`
      })
    },
  
    goAdd() {
      wx.navigateTo({
        url: '/pages/add/add'
      })
    },
  
    goIndex() {
      wx.redirectTo({
        url: '/pages/index/index'
      })
    }
  })