const { exportRecordsToWord } = require('../../utils/export-word')
const { getUserCategories, normalizeCategory, normalizeTags } = require('../../utils/categories')
const { resolveRecordCovers } = require('../../utils/record-cover')

const PAGE_SIZE = 10

Page({
    data: {
      keyword: '',
      currentFilter: '全部',
      filters: ['全部', ...getUserCategories()],
  
      allRecords: [],
      filteredRecords: [],
      records: [],
      pageIndex: 1,
      hasMore: false,
      isGenerating: false,
      showExample: false,
      onboardingTags: ['项目经历', '活动记录', '旅行回忆', '申请材料']
    },
  
    onShow() {
      const shouldShowExample = wx.getStorageSync('showOnboardingExample')
      if (shouldShowExample) {
        wx.removeStorageSync('showOnboardingExample')
        this.setData({ showExample: true })
      }
      this.loadRecords()
    },

    normalizePrivacy(value) {
      const privateValues = ['private', 'encrypted', 'export_confirm', 'locked']
      return privateValues.includes(value) ? 'private' : 'normal'
    },

    decorateRecord(item) {
      const safeItem = item || {}
      const privacy = this.normalizePrivacy(safeItem.privacy)
      return {
        ...safeItem,
        category: normalizeCategory(safeItem.category, getUserCategories()),
        privacy,
        isPrivate: privacy === 'private',
        privacyText: privacy === 'private' ? '私密' : '',
        tags: normalizeTags(safeItem.tags),
        proofSummary: Array.isArray(safeItem.proofSummary) ? safeItem.proofSummary : [],
        files: Array.isArray(safeItem.files) ? safeItem.files : [],
        dateRangeText: this.formatDateRange(safeItem)
      }
    },

    getCategoryFilters() {
      return ['全部', ...getUserCategories()]
    },
  
    async loadRecords() {
      const filters = this.getCategoryFilters()
      const currentFilter = filters.includes(this.data.currentFilter) ? this.data.currentFilter : '全部'
      const rawRecords = wx.getStorageSync('records') || []
      const records = await resolveRecordCovers((Array.isArray(rawRecords) ? rawRecords : []).map(item => this.decorateRecord(item)))
  
      this.setData({ filters, currentFilter, allRecords: records }, () => {
        this.filterRecords()
      })
    },

    formatDateRange(record) {
      if (record && record.endDate && record.endDate !== record.date) {
        return `${record.date} 至 ${record.endDate}`
      }

      return (record && record.date) || ''
    },
  
    onSearchInput(e) {
      const keyword = (e.detail.value || '').trim()
      this.setData({ keyword, pageIndex: 1 })
      this.filterRecords()
    },
  
    changeFilter(e) {
      const name = e.currentTarget.dataset.name || '全部'
      this.setData({ currentFilter: name, pageIndex: 1 })
      this.filterRecords()
    },
  
    filterRecords() {
      const { keyword, currentFilter, allRecords } = this.data
  
      let list = Array.isArray(allRecords) ? allRecords : []
  
      if (currentFilter !== '全部') {
        list = list.filter(item => item.category === currentFilter)
      }
  
      const searchText = (keyword || '').trim().toLowerCase()
  
      if (searchText) {
        list = list.filter(item => {
          const text = [
            item.title || '',
            item.date || '',
            item.endDate || '',
            item.dateRangeText || '',
            item.location || '',
            item.category || '',
            item.role || '',
            item.description || '',
            ...(item.tags || []),
            ...(item.proofSummary || []).map(p => p.name || '')
          ].join(' ').toLowerCase()
  
          return text.includes(searchText)
        })
      }

      this.setData({ filteredRecords: list, pageIndex: 1 }, () => {
        this.updateVisibleRecords()
      })
    },

    updateVisibleRecords() {
      const end = this.data.pageIndex * PAGE_SIZE
      const records = this.data.filteredRecords.slice(0, end)
      this.setData({
        records,
        hasMore: end < this.data.filteredRecords.length
      })
    },

    loadMoreRecords() {
      this.setData({ pageIndex: this.data.pageIndex + 1 }, () => {
        this.updateVisibleRecords()
      })
    },

    getCurrentListExportCondition() {
      const parts = [`导出分类：${this.data.currentFilter || '全部'}`]
      if (this.data.keyword) parts.push(`导出关键词：${this.data.keyword}`)
      return parts.join('，')
    },

    async exportCurrentList() {
      if (this.data.isGenerating) return
      this.setData({ isGenerating: true })
      await exportRecordsToWord(
        this.data.filteredRecords,
        {
          title: '经历记录合并导出',
          condition: this.getCurrentListExportCondition(),
          type: 'category'
        },
        { emptyText: '当前分类下暂无可导出的记录' }
      )
      this.setData({ isGenerating: false })
    },

    async exportSearchResults() {
      if (this.data.isGenerating) return
      this.setData({ isGenerating: true })
      await exportRecordsToWord(
        this.data.filteredRecords,
        {
          title: '经历记录合并导出',
          condition: `导出关键词：${this.data.keyword}`,
          type: 'search'
        },
        { emptyText: '当前搜索结果暂无可导出的记录' }
      )
      this.setData({ isGenerating: false })
    },
  
    goTimeline() {
      wx.navigateTo({ url: '/pages/timeline/timeline' })
    },

    goMergeExport() {
      this.exportCurrentList()
    },

    goFilterExport() {
      wx.navigateTo({ url: '/pages/export/export' })
    },

    goTagManage() {
      wx.navigateTo({ url: '/pages/tagManage/tagManage' })
    },

    openMoreMenu() {
      wx.showActionSheet({
        itemList: ['筛选并导出', '生成长图资料包', '图片转文字 OCR', '标签管理', '关于迹录册'],
        success: res => {
          const index = res.tapIndex
          if (index === 0) this.goFilterExport()
          if (index === 1) wx.showToast({ title: '请进入某条记录详情页生成资料包', icon: 'none' })
          if (index === 2) wx.showToast({ title: 'OCR功能下一步开发', icon: 'none' })
          if (index === 3) this.goTagManage()
          if (index === 4) {
            wx.showModal({
              title: '关于迹录册',
              content: '迹录册是一个帮助你记录、整理和导出经历资料的工具。',
              showCancel: false
            })
          }
        }
      })
    },

    showExampleRecord() {
      this.setData({ showExample: true })
    },

    hideExampleRecord() {
      this.setData({ showExample: false })
    },

    goAddFromExample() {
      wx.navigateTo({ url: '/pages/add/add?template=communityActivity' })
    },
  
    goAdd() {
      wx.navigateTo({ url: '/pages/add/add' })
    },
  
    goDetail(e) {
      const id = e.currentTarget.dataset.id
      wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
    }
  })