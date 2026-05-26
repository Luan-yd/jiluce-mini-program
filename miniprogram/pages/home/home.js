Page({
  data: {
    recordCount: 0,
    materialCount: 0,
    latestUpdate: '暂无记录',
    categoryStats: [],
    recentRecords: []
  },

  onShow() {
    this.loadHomeData()
  },

  loadHomeData() {
    const records = wx.getStorageSync('records') || []

    const recordCount = records.length

    const materialCount = records.reduce((sum, item) => {
      return sum + ((item.files && item.files.length) || 0)
    }, 0)

    const latestUpdate = records.length > 0
      ? this.formatDate(records[0].updatedAt || records[0].createdAt || records[0].date)
      : '暂无记录'

    const categories = ['展会', '兼职', '实习', '项目', '证书', '其他']

    const categoryStats = categories.map(name => {
      const count = records.filter(item => {
        if (name === '其他') {
          return !['展会', '兼职', '实习', '项目', '证书'].includes(item.category)
        }
        return item.category === name
      }).length

      return {
        name,
        count,
        icon: this.getCategoryIcon(name)
      }
    })

    const recentRecords = records.slice(0, 3).map(item => ({
      ...item,
      displayDate: this.formatDate(item.date),
      materialText: `${(item.files && item.files.length) || 0}份材料`,
      coverDisplay: item.cover || ''
    }))

    this.setData({
      recordCount,
      materialCount,
      latestUpdate,
      categoryStats,
      recentRecords
    })
  },

  getCategoryIcon(name) {
    const map = {
      '展会': '🏢',
      '兼职': '💼',
      '实习': '🎓',
      '项目': '📚',
      '证书': '📜',
      '其他': '▦'
    }

    return map[name] || '▦'
  },

  formatDate(value) {
    if (!value) return '暂无记录'

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value.replace(/-/g, '.')
    }

    const date = new Date(value)

    if (isNaN(date.getTime())) {
      return String(value).replace(/-/g, '.')
    }

    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')

    return `${y}.${m}.${d}`
  },

  goAddRecord() {
    wx.navigateTo({
      url: '/pages/add/add'
    })
  },

  goAllRecords() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id

    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    })
  }
})