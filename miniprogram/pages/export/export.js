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
    conditionText: '请选择筛选条件',
    isGenerating: false
  },

  onShow() {
    this.refreshPageData()
  },

  normalizePrivacy(value) {
    const privateValues = ['private', 'encrypted', 'export_confirm', 'locked']
    return privateValues.includes(value) ? 'private' : 'normal'
  },

  refreshPageData() {
    const rawRecords = wx.getStorageSync('records') || []
    const sourceRecords = Array.isArray(rawRecords) ? rawRecords : []
    const tagMap = {}

    sourceRecords.forEach(record => {
      ;((record && record.tags) || []).forEach(tag => {
        if (tag) tagMap[tag] = true
      })
    })

    const cachedCategories = wx.getStorageSync(CATEGORY_STORAGE_KEY)
    const categories = Array.isArray(cachedCategories) && cachedCategories.length ? cachedCategories : DEFAULT_CATEGORIES
    const tags = Object.keys(tagMap)
    const nextState = {
      mode: this.data.mode || 'date',
      dateType: this.data.dateType || 'day',
      exportDate: this.data.exportDate || '',
      startDate: this.data.startDate || '',
      endDate: this.data.endDate || '',
      tags,
      categories,
      selectedTag: tags.includes(this.data.selectedTag) ? this.data.selectedTag : tags[0] || '',
      selectedCategory: categories.includes(this.data.selectedCategory) ? this.data.selectedCategory : categories[0] || ''
    }
    const filterResult = this.getFilteredRecords(sourceRecords, nextState)

    this.setData({
      ...nextState,
      records: filterResult.records,
      conditionText: filterResult.conditionText
    })
  },

  changeMode(e) {
    const mode = e.currentTarget.dataset.mode || 'date'
    this.updateFilter({ mode })
  },

  changeDateType(e) {
    const dateType = e.currentTarget.dataset.type || 'day'
    this.updateFilter({ dateType })
  },

  onExportDateChange(e) {
    this.updateFilter({ exportDate: e.detail.value || '' })
  },

  onStartDateChange(e) {
    const start = e.detail.value || ''
    if (this.data.endDate && start > this.data.endDate) {
      wx.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' })
      return
    }
    this.updateFilter({ startDate: start })
  },

  onEndDateChange(e) {
    const end = e.detail.value || ''
    if (this.data.startDate && end < this.data.startDate) {
      wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
      return
    }
    this.updateFilter({ endDate: end })
  },

  onTagChange(e) {
    const index = Number(e.detail.value)
    this.updateFilter({ selectedTag: this.data.tags[index] || '' })
  },

  onCategoryChange(e) {
    const index = Number(e.detail.value)
    this.updateFilter({ selectedCategory: this.data.categories[index] || '' })
  },

  updateFilter(patch) {
    const nextState = {
      mode: this.data.mode,
      dateType: this.data.dateType,
      exportDate: this.data.exportDate,
      startDate: this.data.startDate,
      endDate: this.data.endDate,
      tags: Array.isArray(this.data.tags) ? this.data.tags : [],
      categories: Array.isArray(this.data.categories) ? this.data.categories : DEFAULT_CATEGORIES,
      selectedTag: this.data.selectedTag,
      selectedCategory: this.data.selectedCategory,
      ...patch
    }
    const rawRecords = wx.getStorageSync('records') || []
    const sourceRecords = Array.isArray(rawRecords) ? rawRecords : []
    const filterResult = this.getFilteredRecords(sourceRecords, nextState)

    this.setData({
      ...patch,
      records: filterResult.records,
      conditionText: filterResult.conditionText
    })
  },

  getFilteredRecords(sourceRecords, state) {
    const allRecords = (Array.isArray(sourceRecords) ? sourceRecords : []).map(item => {
      const safeItem = item || {}
      const privacy = this.normalizePrivacy(safeItem.privacy)
      return {
        ...safeItem,
        privacy,
        isPrivate: privacy === 'private',
        dateRangeText: this.formatDateRange(safeItem),
        tags: Array.isArray(safeItem.tags) ? safeItem.tags : [],
        proofSummary: Array.isArray(safeItem.proofSummary) ? safeItem.proofSummary : [],
        files: Array.isArray(safeItem.files) ? safeItem.files : []
      }
    })

    let list = []
    let conditionText = ''

    if (state.mode === 'date') {
      if (state.dateType === 'day') {
        conditionText = state.exportDate ? `日期：${state.exportDate}` : '请选择某一天'
        list = state.exportDate ? allRecords.filter(item => this.isRecordInRange(item, state.exportDate, state.exportDate)) : []
      } else {
        conditionText = state.startDate || state.endDate ? `日期范围：${state.startDate || '不限'} 至 ${state.endDate || '不限'}` : '请选择时间范围'
        list = state.startDate || state.endDate ? allRecords.filter(item => this.isRecordInRange(item, state.startDate, state.endDate)) : []
      }
    }

    if (state.mode === 'tag') {
      conditionText = state.selectedTag ? `标签：${state.selectedTag}` : '暂无可选标签'
      list = state.selectedTag ? allRecords.filter(item => item.tags.includes(state.selectedTag)) : []
    }

    if (state.mode === 'category') {
      conditionText = state.selectedCategory ? `分类：${state.selectedCategory}` : '暂无可选分类'
      list = state.selectedCategory ? allRecords.filter(item => item.category === state.selectedCategory) : []
    }

    return {
      records: list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)),
      conditionText
    }
  },

  isRecordInRange(record, start, end) {
    const recordStart = (record && record.date) || ''
    const recordEnd = (record && (record.endDate || record.date)) || ''
    if (!recordStart) return false
    if (start && recordEnd < start) return false
    if (end && recordStart > end) return false
    return true
  },

  formatDateRange(record) {
    if (record && record.endDate && record.endDate !== record.date) return `${record.date} 至 ${record.endDate}`
    return (record && record.date) || ''
  },

  goBack() { wx.navigateBack() },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` })
  },

  confirmPrivateExport(callback) {
    const records = Array.isArray(this.data.records) ? this.data.records : []
    const hasPrivate = records.some(item => item && item.isPrivate)
    if (!hasPrivate) {
      callback()
      return
    }

    wx.showModal({
      title: '导出确认',
      content: '当前导出内容包含私密记录，是否确认继续导出？',
      confirmText: '继续导出',
      cancelText: '取消',
      success: res => { if (res.confirm) callback() }
    })
  },

  exportWord() {
    const records = Array.isArray(this.data.records) ? this.data.records : []
    if (!records.length) {
      wx.showToast({ title: '暂无可导出的记录', icon: 'none' })
      return
    }
    if (this.data.isGenerating) return
    this.confirmPrivateExport(() => this.generateWord())
  },

  deleteGeneratedWord(fileID) {
    if (!fileID) return
    wx.cloud.deleteFile({
      fileList: [fileID],
      success: () => console.log('合并导出 Word 云文件已清理'),
      fail: err => console.error('合并导出 Word 云文件清理失败：', err)
    })
  },

  async generateWord() {
    if (this.data.isGenerating) return
    this.setData({ isGenerating: true })
    wx.showLoading({ title: '生成Word中…', mask: true })

    try {
      const records = (Array.isArray(this.data.records) ? this.data.records : []).map(item => ({
        title: item.title || '未命名记录',
        date: item.date || '',
        endDate: item.endDate || '',
        dateRangeText: this.formatDateRange(item),
        category: item.category || '',
        location: item.location || '',
        role: item.role || '',
        description: item.description || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        privacy: item.privacy || 'normal',
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
        const errorText = result.result && result.result.error ? result.result.error : '生成失败'
        wx.showToast({ title: errorText, icon: 'none' })
        return
      }

      const fileID = result.result.fileID
      const downloadResult = await wx.cloud.downloadFile({ fileID })
      this.deleteGeneratedWord(fileID)

      wx.openDocument({
        filePath: downloadResult.tempFilePath,
        fileType: 'docx',
        showMenu: true,
        success: () => wx.showToast({ title: '已生成Word', icon: 'success' }),
        fail: err => {
          console.error('打开 Word 失败：', err)
          wx.showToast({ title: '请在文件管理中查看', icon: 'none' })
        }
      })
    } catch (err) {
      wx.hideLoading()
      console.error('合并导出失败：', err)
      wx.showToast({ title: '生成失败，请重试', icon: 'none' })
    } finally {
      this.setData({ isGenerating: false })
    }
  }
})