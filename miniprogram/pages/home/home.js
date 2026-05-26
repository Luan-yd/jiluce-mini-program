const DEFAULT_CATEGORIES = ['项目', '实习', '旅游', '记忆', '其他']
const CATEGORY_STORAGE_KEY = 'customCategories'

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

  getCategories() {
    const cachedCategories = wx.getStorageSync(CATEGORY_STORAGE_KEY)
    return Array.isArray(cachedCategories) ? cachedCategories : DEFAULT_CATEGORIES
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

    const categories = this.getCategories()

    const categoryStats = categories.map(name => ({
      name,
      count: records.filter(item => item.category === name).length,
      icon: this.getCategoryIcon(name)
    }))

    const recentRecords = records.slice(0, 3).map(item => ({
      ...item,
      displayDate: this.formatDateRange(item),
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
      '项目': '▤',
      '实习': '◫',
      '旅游': '◇',
      '记忆': '◌',
      '其他': '▦'
    }

    return map[name] || '▦'
  },

  formatDateRange(record) {
    if (record.endDate && record.endDate !== record.date) {
      return `${record.date} 至 ${record.endDate}`
    }

    return record.date || '暂无记录'
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