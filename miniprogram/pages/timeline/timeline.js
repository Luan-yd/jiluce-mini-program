const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '本年' },
  { key: 'custom', label: '自定义' }
]
const PAGE_SIZE = 10

Page({
  data: {
    groups: [],
    filters: FILTERS,
    currentFilter: 'all',
    customStartDate: '',
    customEndDate: '',
    filteredRecords: [],
    visibleCount: PAGE_SIZE,
    hasMore: false,
    hasAnyRecords: false,
    emptyText: '还没有时间轴记录',
    emptyDesc: '先添加一条经历证明，它会自动出现在这里。'
  },

  onLoad() {
    this.loadTimeline()
  },

  onShow() {
    this.loadTimeline()
  },

  normalizePrivacy(value) {
    const privateValues = ['private', 'encrypted', 'export_confirm', 'locked']
    return privateValues.includes(value) ? 'private' : 'normal'
  },

  loadTimeline() {
    const rawRecords = wx.getStorageSync('records') || []
    const records = Array.isArray(rawRecords) ? rawRecords : []
    const decoratedRecords = records.map(item => {
      const privacy = this.normalizePrivacy(item && item.privacy)
      return { ...(item || {}), privacy, isPrivate: privacy === 'private' }
    })
    this.applyFilter(decoratedRecords)
  },

  changeFilter(e) {
    const key = e.currentTarget.dataset.key || 'all'
    this.setData({ currentFilter: key, visibleCount: PAGE_SIZE }, () => {
      this.loadTimeline()
    })
  },

  onCustomStartChange(e) {
    const start = e.detail.value || ''
    if (this.data.customEndDate && start > this.data.customEndDate) {
      wx.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' })
      return
    }
    this.setData({ customStartDate: start, currentFilter: 'custom', visibleCount: PAGE_SIZE }, () => {
      this.loadTimeline()
    })
  },

  onCustomEndChange(e) {
    const end = e.detail.value || ''
    if (this.data.customStartDate && end < this.data.customStartDate) {
      wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
      return
    }
    this.setData({ customEndDate: end, currentFilter: 'custom', visibleCount: PAGE_SIZE }, () => {
      this.loadTimeline()
    })
  },

  applyFilter(records) {
    const safeRecords = Array.isArray(records) ? records : []
    const range = this.getFilterRange()
    const filteredRecords = safeRecords
      .filter(record => this.isRecordInRange(record, range))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

    const visibleRecords = filteredRecords.slice(0, this.data.visibleCount)
    const groups = this.buildGroups(visibleRecords)
    const hasAnyRecords = safeRecords.length > 0

    this.setData({
      filteredRecords,
      groups,
      hasMore: this.data.visibleCount < filteredRecords.length,
      hasAnyRecords,
      emptyText: hasAnyRecords ? '暂无符合条件的记录' : '还没有时间轴记录',
      emptyDesc: hasAnyRecords ? '可以切换筛选条件或调整自定义日期范围。' : '先添加一条经历证明，它会自动出现在这里。'
    })
  },

  buildGroups(records) {
    const groupMap = {}
    ;(Array.isArray(records) ? records : []).forEach(record => {
      const monthKey = this.getMonthKey(record.date || '')
      if (!groupMap[monthKey]) groupMap[monthKey] = []
      groupMap[monthKey].push(record)
    })

    return Object.keys(groupMap).map(month => ({ month, records: groupMap[month] }))
  },

  updateVisibleGroups() {
    const visibleRecords = this.data.filteredRecords.slice(0, this.data.visibleCount)
    this.setData({
      groups: this.buildGroups(visibleRecords),
      hasMore: this.data.visibleCount < this.data.filteredRecords.length
    })
  },

  loadMoreRecords() {
    this.setData({ visibleCount: this.data.visibleCount + PAGE_SIZE }, () => {
      this.updateVisibleGroups()
    })
  },

  getFilterRange() {
    const key = this.data.currentFilter
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
    if (key === 'custom') return { start: this.data.customStartDate, end: this.data.customEndDate }
    return null
  },

  isRecordInRange(record, range) {
    if (!range) return true
    const recordStart = (record && record.date) || ''
    const recordEnd = (record && (record.endDate || record.date)) || ''
    if (!recordStart) return false
    if (range.start && recordEnd < range.start) return false
    if (range.end && recordStart > range.end) return false
    return true
  },

  formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  },

  getMonthKey(dateString) {
    if (!dateString) return '未填写日期'
    const parts = String(dateString).split('-')
    if (parts.length < 2) return '未填写日期'
    return `${parts[0]}年${Number(parts[1])}月`
  },

  goMergeExport() {
    wx.navigateTo({ url: '/pages/export/export' })
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` })
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/add/add' })
  },

  goIndex() {
    wx.redirectTo({ url: '/pages/index/index' })
  }
})