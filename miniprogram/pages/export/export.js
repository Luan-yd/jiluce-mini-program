const DEFAULT_CATEGORIES = ['项目', '实习', '旅游', '记忆', '其他']
const CATEGORY_STORAGE_KEY = 'customCategories'

Page({
  data: {
    mode: 'date',
    modes: [
      { key: 'date', label: '按日期' },
      { key: 'tag', label: '按标签' },
      { key: 'category', label: '按分类' }
    ],
    dateType: 'day',
    exportDate: '',
    startDate: '',
    endDate: '',
    tags: [],
    categories: DEFAULT_CATEGORIES,
    selectedTag: '',
    selectedCategory: '',
    records: [],
    conditionText: '请选择筛选条件'
  },

  onShow() {
    this.initOptions()
    this.applyFilter()
  },

  normalizePrivacy(value) {
    const privateValues = ['private', 'encrypted', 'export_confirm', 'locked']
    return privateValues.includes(value) ? 'private' : 'normal'
  },

  initOptions() {
    const records = wx.getStorageSync('records') || []
    const tagMap = {}

    records.forEach(record => {
      ;(record.tags || []).forEach(tag => {
        if (tag) tagMap[tag] = true
      })
    })

    const cachedCategories = wx.getStorageSync(CATEGORY_STORAGE_KEY)
    const categories = Array.isArray(cachedCategories) ? cachedCategories : DEFAULT_CATEGORIES
    const tags = Object.keys(tagMap)

    this.setData({
      tags,
      categories,
      selectedTag: this.data.selectedTag || tags[0] || '',
      selectedCategory: this.data.selectedCategory || categories[0] || ''
    })
  },

  changeMode(e) {
    this.setData({
      mode: e.currentTarget.dataset.mode
    }, () => {
      this.applyFilter()
    })
  },

  changeDateType(e) {
    this.setData({
      dateType: e.currentTarget.dataset.type
    }, () => {
      this.applyFilter()
    })
  },

  onExportDateChange(e) {
    this.setData({
      exportDate: e.detail.value
    }, () => {
      this.applyFilter()
    })
  },

  onStartDateChange(e) {
    const start = e.detail.value
    if (this.data.endDate && start > this.data.endDate) {
      wx.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' })
      return
    }

    this.setData({ startDate: start }, () => {
      this.applyFilter()
    })
  },

  onEndDateChange(e) {
    const end = e.detail.value
    if (this.data.startDate && end < this.data.startDate) {
      wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
      return
    }

    this.setData({ endDate: end }, () => {
      this.applyFilter()
    })
  },

  onTagChange(e) {
    const index = Number(e.detail.value)
    this.setData({
      selectedTag: this.data.tags[index] || ''
    }, () => {
      this.applyFilter()
    })
  },

  onCategoryChange(e) {
    const index = Number(e.detail.value)
    this.setData({
      selectedCategory: this.data.categories[index] || ''
    }, () => {
      this.applyFilter()
    })
  },

  applyFilter() {
    const allRecords = (wx.getStorageSync('records') || []).map(item => {
      const privacy = this.normalizePrivacy(item.privacy)
      return {
        ...item,
        privacy,
        isPrivate: privacy === 'private',
        dateRangeText: this.formatDateRange(item)
      }
    })

    let list = []
    let conditionText = ''

    if (this.data.mode === 'date') {
      if (this.data.dateType === 'day') {
        conditionText = this.data.exportDate ? `日期：${this.data.exportDate}` : '请选择某一天'
        list = this.data.exportDate
          ? allRecords.filter(item => this.isRecordInRange(item, this.data.exportDate, this.data.exportDate))
          : []
      } else {
        conditionText = this.data.startDate || this.data.endDate
          ? `日期范围：${this.data.startDate || '不限'} 至 ${this.data.endDate || '不限'}`
          : '请选择时间范围'
        list = this.data.startDate || this.data.endDate
          ? allRecords.filter(item => this.isRecordInRange(item, this.data.startDate, this.data.endDate))
          : []
      }
    }

    if (this.data.mode === 'tag') {
      conditionText = this.data.selectedTag ? `标签：${this.data.selectedTag}` : '暂无可选标签'
      list = this.data.selectedTag
        ? allRecords.filter(item => (item.tags || []).includes(this.data.selectedTag))
        : []
    }

    if (this.data.mode === 'category') {
      conditionText = this.data.selectedCategory ? `分类：${this.data.selectedCategory}` : '暂无可选分类'
      list = this.data.selectedCategory
        ? allRecords.filter(item => item.category === this.data.selectedCategory)
        : []
    }

    list = list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

    this.setData({
      records: list,
      conditionText
    })
  },

  isRecordInRange(record, start, end) {
    const recordStart = record.date || ''
    const recordEnd = record.endDate || record.date || ''

    if (!recordStart) return false
    if (start && recordEnd < start) return false
    if (end && recordStart > end) return false

    return true
  },

  formatDateRange(record) {
    if (record.endDate && record.endDate !== record.date) {
      return `${record.date} 至 ${record.endDate}`
    }

    return record.date || ''
  },

  goBack() {
    wx.navigateBack()
  },

  goDetail(e) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}`
    })
  },

  confirmPrivateExport(callback) {
    const hasPrivate = this.data.records.some(item => item.isPrivate)

    if (!hasPrivate) {
      callback()
      return
    }

    wx.showModal({
      title: '导出确认',
      content: '当前导出内容包含私密记录，是否确认继续导出？',
      confirmText: '继续导出',
      cancelText: '取消',
      success: res => {
        if (res.confirm) callback()
      }
    })
  },

  exportWord() {
    if (!this.data.records.length) {
      wx.showToast({
        title: '暂无可导出的记录',
        icon: 'none'
      })
      return
    }

    this.confirmPrivateExport(() => {
      this.generateWord()
    })
  },

  async generateWord() {
    wx.showLoading({
      title: '生成Word中…',
      mask: true
    })

    try {
      const records = this.data.records.map(item => ({
        title: item.title || '未命名记录',
        date: item.date || '',
        endDate: item.endDate || '',
        dateRangeText: this.formatDateRange(item),
        category: item.category || '',
        location: item.location || '',
        role: item.role || '',
        description: item.description || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        privacy: item.privacy,
        proofSummary: Array.isArray(item.proofSummary) ? item.proofSummary : [],
        files: Array.isArray(item.files)
          ? item.files.map(file => ({
              type: file.type || file.name || '材料',
              path: file.path || file.fileID || file.url || ''
            })).filter(file => file.path)
          : []
      }))

      const result = await wx.cloud.callFunction({
        name: 'generateWord',
        data: {
          records,
          exportMeta: {
            title: '筛选合并导出',
            condition: this.data.conditionText,
            exportedAt: new Date().toLocaleString()
          }
        }
      })

      wx.hideLoading()

      if (!result.result || !result.result.success) {
        wx.showToast({
          title: result.result?.error || '生成失败',
          icon: 'none'
        })
        return
      }

      const downloadResult = await wx.cloud.downloadFile({ fileID: result.result.fileID })

      wx.openDocument({
        filePath: downloadResult.tempFilePath,
        fileType: 'docx',
        showMenu: true,
        success: () => {
          wx.showToast({ title: '已生成Word', icon: 'success' })
        },
        fail: err => {
          console.error('打开 Word 失败：', err)
          wx.showToast({ title: '请在文件管理中查看', icon: 'none' })
        }
      })
    } catch (err) {
      wx.hideLoading()
      console.error('合并导出失败：', err)
      wx.showToast({
        title: '生成失败，请重试',
        icon: 'none'
      })
    }
  }
})