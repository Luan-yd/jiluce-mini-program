const { getUserCategories, normalizeCategory, normalizeTags } = require('../../utils/categories')
const { resolveRecordCovers } = require('../../utils/record-cover')

const DEFAULT_CATEGORY_ICONS = {
  '项目': '📁',
  '实习': '💼',
  '旅游': '✈️',
  '记忆': '📷',
  '其他': '✨'
}
const BACKUP_CATEGORY_ICONS = [
  '🗂️',
  '📝',
  '📌',
  '⭐',
  '🎯',
  '🧩',
  '📚',
  '🏆',
  '💡',
  '🔖',
  '🧾',
  '🖼️',
  '🎒',
  '🌱',
  '🛠️',
  '🤝',
  '📍',
  '🕒',
  '🎓',
  '🏡'
]

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

  async loadHomeData() {
    const categories = getUserCategories()
    const rawRecords = wx.getStorageSync('records') || []
    const records = await resolveRecordCovers((Array.isArray(rawRecords) ? rawRecords : []).map(item => ({
      ...(item || {}),
      category: normalizeCategory(item && item.category, categories),
      tags: normalizeTags(item && item.tags)
    })))

    const recordCount = records.length

    const materialCount = records.reduce((sum, item) => {
      return sum + ((item.files && item.files.length) || 0)
    }, 0)

    const latestUpdate = records.length > 0
      ? this.formatDate(records[0].updatedAt || records[0].createdAt || records[0].date)
      : '暂无记录'

    const categoryStats = categories.map((name, index) => ({
      name,
      count: records.filter(item => item.category === name).length,
      icon: this.getCategoryIcon(name, index)
    }))

    const recentRecords = records.slice(0, 3).map(item => ({
      ...item,
      displayDate: this.formatDateRange(item),
      materialText: `${(item.files && item.files.length) || 0}份材料`,
      coverDisplay: item.coverDisplay || ''
    }))

    this.setData({
      recordCount,
      materialCount,
      latestUpdate,
      categoryStats,
      recentRecords
    })
  },

  getCategoryIcon(name, index) {
    if (DEFAULT_CATEGORY_ICONS[name]) {
      return DEFAULT_CATEGORY_ICONS[name]
    }

    return BACKUP_CATEGORY_ICONS[index % BACKUP_CATEGORY_ICONS.length]
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

  showExampleRecord() {
    wx.navigateTo({
      url: '/pages/example/example'
    })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id

    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    })
  }
})