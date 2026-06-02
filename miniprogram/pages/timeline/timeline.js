const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '本年' },
  { key: 'custom', label: '自定义' }
]

Page({
    data: {
      groups: [],
      filters: FILTERS,
      currentFilter: 'all',
      customStartDate: '',
      customEndDate: '',
      emptyText: '还没有时间轴记录'
    },
  
    onShow() {
      this.loadTimeline()
    },

    normalizePrivacy(value) {
      const privateValues = ['private', 'encrypted', 'export_confirm', 'locked']
      return privateValues.includes(value) ? 'private' : 'normal'
    },
  
    loadTimeline() {
      const records = wx.getStorageSync('records') || []
      const decoratedRecords = records.map(item => {
        const privacy = this.normalizePrivacy(item.privacy)
        return {
          ...item,
          privacy,
          isPrivate: privacy === 'private'
        }
      })
      this.applyFilter(decoratedRecords)
    },

    changeFilter(e) {
      const key = e.currentTarget.dataset.key
      this.setData({
        currentFilter: key
      }, () => {
        this.loadTimeline()
      })
    },

    onCustomStartChange(e) {
      const start = e.detail.value
      const end = this.data.customEndDate

      if (end && start > end) {
        wx.showToast({
          title: '开始日期不能晚于结束日期',
          icon: 'none'
        })
        return
      }

      this.setData({
        customStartDate: start,
        currentFilter: 'custom'
      }, () => {
        this.loadTimeline()
      })
    },

    onCustomEndChange(e) {
      const end = e.detail.value
      const start = this.data.customStartDate

      if (start && end < start) {
        wx.showToast({
          title: '结束日期不能早于开始日期',
          icon: 'none'
        })
        return
      }

      this.setData({
        customEndDate: end,
        currentFilter: 'custom'
      }, () => {
        this.loadTimeline()
      })
    },

    applyFilter(records) {
      const range = this.getFilterRange()
      const filteredRecords = records.filter(record => this.isRecordInRange(record, range))
      const sortedRecords = [...filteredRecords].sort((a, b) => {
        return new Date(b.date || 0) - new Date(a.date || 0)
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
        groups,
        emptyText: records.length === 0 ? '还没有时间轴记录' : '暂无符合条件的记录'
      })
    },

    getFilterRange() {
      const key = this.data.currentFilter
      const today = new Date()
      const todayText = this.formatDate(today)

      if (key === 'today') {
        return { start: todayText, end: todayText }
      }

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

      if (key === 'year') {
        return {
          start: `${today.getFullYear()}-01-01`,
          end: `${today.getFullYear()}-12-31`
        }
      }

      if (key === 'custom') {
        return {
          start: this.data.customStartDate,
          end: this.data.customEndDate
        }
      }

      return null
    },

    isRecordInRange(record, range) {
      if (!range) return true

      const start = range.start
      const end = range.end
      const recordStart = record.date || ''
      const recordEnd = record.endDate || record.date || ''

      if (!recordStart) return false
      if (start && recordEnd < start) return false
      if (end && recordStart > end) return false

      return true
    },

    formatDate(date) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
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