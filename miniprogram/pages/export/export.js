const { exportRecordsToWord } = require('../../utils/export-word')

const DEFAULT_CATEGORIES = ['项目', '实习', '旅游', '记忆', '其他']
const CATEGORY_STORAGE_KEY = 'customCategories'
const TIME_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '本年' },
  { key: 'custom', label: '自定义' }
]

Page({
  data: {
    categories: ['全部', ...DEFAULT_CATEGORIES],
    tags: [],
    tagOptions: ['全部标签'],
    timeFilters: TIME_FILTERS,
    selectedCategory: '全部',
    selectedTag: '全部标签',
    selectedTime: 'all',
    customStartDate: '',
    customEndDate: '',
    keyword: '',
    records: [],
    resultCount: 0,
    conditionText: '分类：全部；标签：全部标签；时间：全部',
    isGenerating: false
  },

  onShow() {
    this.refreshPageData()
  },

  normalizePrivacy(value) {
    const privateValues = ['private', 'encrypted', 'export_confirm', 'locked']
    return privateValues.includes(value) ? 'private' : 'normal'
  },

  normalizeCategory(value) {
    return value || '其他'
  },

  normalizeTags(value) {
    return Array.isArray(value) ? value.filter(Boolean) : []
  },

  getManagedCategories() {
    const cachedCategories = wx.getStorageSync(CATEGORY_STORAGE_KEY)
    const categories = Array.isArray(cachedCategories) && cachedCategories.length ? cachedCategories : DEFAULT_CATEGORIES
    return categories.includes('其他') ? categories : [...categories, '其他']
  },

  refreshPageData() {
    const allRecords = this.getAllRecords()
    const tagMap = {}
    allRecords.forEach(record => {
      record.tags.forEach(tag => { tagMap[tag] = true })
    })

    const managedCategories = this.getManagedCategories()
    const categories = ['全部', ...managedCategories]
    const tags = Object.keys(tagMap)
    const tagOptions = tags.length ? ['全部标签', ...tags] : ['暂无标签']
    const selectedCategory = categories.includes(this.data.selectedCategory) ? this.data.selectedCategory : '全部'
    const selectedTag = tagOptions.includes(this.data.selectedTag) ? this.data.selectedTag : tagOptions[0]
    const filterResult = this.filterRecords(allRecords, {
      selectedCategory,
      selectedTag,
      selectedTime: this.data.selectedTime,
      customStartDate: this.data.customStartDate,
      customEndDate: this.data.customEndDate,
      keyword: this.data.keyword
    })

    this.setData({
      categories,
      tags,
      tagOptions,
      selectedCategory,
      selectedTag,
      records: filterResult.records,
      resultCount: filterResult.records.length,
      conditionText: filterResult.conditionText
    })
  },

  getAllRecords() {
    const rawRecords = wx.getStorageSync('records') || []
    return (Array.isArray(rawRecords) ? rawRecords : []).map(item => {
      const safeItem = item || {}
      const privacy = this.normalizePrivacy(safeItem.privacy)
      const category = this.normalizeCategory(safeItem.category)
      return {
        ...safeItem,
        category,
        privacy,
        isPrivate: privacy === 'private',
        tags: this.normalizeTags(safeItem.tags),
        proofSummary: Array.isArray(safeItem.proofSummary) ? safeItem.proofSummary : [],
        files: Array.isArray(safeItem.files) ? safeItem.files : [],
        dateRangeText: this.formatDateRange(safeItem)
      }
    })
  },

  updateFilter(patch) {
    const state = {
      selectedCategory: this.data.selectedCategory,
      selectedTag: this.data.selectedTag,
      selectedTime: this.data.selectedTime,
      customStartDate: this.data.customStartDate,
      customEndDate: this.data.customEndDate,
      keyword: this.data.keyword,
      ...patch
    }
    const filterResult = this.filterRecords(this.getAllRecords(), state)
    this.setData({
      ...patch,
      records: filterResult.records,
      resultCount: filterResult.records.length,
      conditionText: filterResult.conditionText
    })
  },

  onCategoryChange(e) {
    const index = Number(e.detail.value)
    this.updateFilter({ selectedCategory: this.data.categories[index] || '全部' })
  },

  onTagChange(e) {
    const index = Number(e.detail.value)
    const selectedTag = this.data.tagOptions[index] || this.data.tagOptions[0] || '暂无标签'
    this.updateFilter({ selectedTag })
  },

  changeTimeFilter(e) {
    const selectedTime = e.currentTarget.dataset.key || 'all'
    this.updateFilter({ selectedTime })
  },

  onCustomStartChange(e) {
    const start = e.detail.value || ''
    if (this.data.customEndDate && start > this.data.customEndDate) {
      wx.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' })
      return
    }
    this.updateFilter({ customStartDate: start, selectedTime: 'custom' })
  },

  onCustomEndChange(e) {
    const end = e.detail.value || ''
    if (this.data.customStartDate && end < this.data.customStartDate) {
      wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
      return
    }
    this.updateFilter({ customEndDate: end, selectedTime: 'custom' })
  },

  onKeywordInput(e) {
    this.updateFilter({ keyword: (e.detail.value || '').trim() })
  },

  filterRecords(sourceRecords, state) {
    const selectedCategory = state.selectedCategory || '全部'
    const selectedTag = state.selectedTag || '全部标签'
    const selectedTime = state.selectedTime || 'all'
    const keyword = (state.keyword || '').trim().toLowerCase()
    const range = this.getTimeRange(selectedTime, state.customStartDate, state.customEndDate)

    let list = Array.isArray(sourceRecords) ? sourceRecords : []

    if (selectedCategory !== '全部') {
      list = list.filter(record => record.category === selectedCategory)
    }

    if (selectedTag !== '全部标签' && selectedTag !== '暂无标签') {
      list = list.filter(record => record.tags.includes(selectedTag))
    }

    if (range) {
      list = list.filter(record => this.isRecordInRange(record, range.start, range.end))
    }

    if (keyword) {
      list = list.filter(record => {
        const fileText = (record.files || []).map(file => [file.name || '', file.type || '', file.desc || '', file.description || ''].join(' ')).join(' ')
        const text = [
          record.title || '',
          record.location || '',
          record.role || '',
          record.description || '',
          record.category || '',
          record.dateRangeText || '',
          ...(record.tags || []),
          ...(record.proofSummary || []).map(item => item.name || ''),
          fileText
        ].join(' ').toLowerCase()
        return text.includes(keyword)
      })
    }

    const conditionText = this.buildConditionText(state)
    return {
      records: list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)),
      conditionText
    }
  },

  getTimeRange(key, customStartDate, customEndDate) {
    const today = new Date()
    const todayText = this.formatDate(today)
    if (key === 'today') return { start: todayText, end: todayText }

    if (key === 'week') {
      const day = today.getDay() || 7
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - day + 1)
      const endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 6)
      return { start: this.formatDate(startDate), end: this.formatDate(endDate) }
    }

    if (key === 'month') {
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return { start: this.formatDate(startDate), end: this.formatDate(endDate) }
    }

    if (key === 'year') return { start: `${today.getFullYear()}-01-01`, end: `${today.getFullYear()}-12-31` }
    if (key === 'custom') return customStartDate || customEndDate ? { start: customStartDate, end: customEndDate } : null
    return null
  },

  isRecordInRange(record, start, end) {
    const recordStart = (record && record.date) || ''
    const recordEnd = (record && (record.endDate || record.date)) || ''
    if (!recordStart) return false
    if (start && recordEnd < start) return false
    if (end && recordStart > end) return false
    return true
  },

  buildConditionText(state) {
    const timeLabel = this.getTimeText(state.selectedTime, state.customStartDate, state.customEndDate)
    const parts = [
      `分类：${state.selectedCategory || '全部'}`,
      `标签：${state.selectedTag || '全部标签'}`,
      `时间：${timeLabel}`
    ]
    if (state.keyword) parts.push(`关键词：${state.keyword}`)
    return parts.join('；')
  },

  getTimeText(key, customStartDate, customEndDate) {
    if (key === 'custom') return `${customStartDate || '不限'} 至 ${customEndDate || '不限'}`
    const current = TIME_FILTERS.find(item => item.key === key)
    return current ? current.label : '全部'
  },

  formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  },

  formatDateRange(record) {
    if (record && record.endDate && record.endDate !== record.date) return `${record.date} 至 ${record.endDate}`
    return (record && record.date) || ''
  },

  goBack() { wx.navigateBack() },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` })
  },

  async exportWord() {
    if (this.data.isGenerating) return
    this.setData({ isGenerating: true })
    await exportRecordsToWord(
      this.data.records,
      {
        title: '筛选合并导出',
        condition: this.data.conditionText,
        type: 'combined-filter'
      },
      { emptyText: '当前筛选下暂无可导出的记录' }
    )
    this.setData({ isGenerating: false })
  }
})