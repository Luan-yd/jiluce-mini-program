const DEFAULT_CATEGORIES = ['项目', '实习', '旅游', '记忆', '其他']
const CATEGORY_STORAGE_KEY = 'customCategories'

Page({
    data: {
      keyword: '',
      currentFilter: '全部',
      filters: ['全部', ...DEFAULT_CATEGORIES],
  
      allRecords: [],
      records: []
    },
  
    onShow() {
      this.loadRecords()
    },

    normalizePrivacy(value) {
      const privateValues = ['private', 'encrypted', 'export_confirm', 'locked']
      return privateValues.includes(value) ? 'private' : 'normal'
    },

    decorateRecord(item) {
      const privacy = this.normalizePrivacy(item.privacy)
      return {
        ...item,
        privacy,
        isPrivate: privacy === 'private',
        privacyText: privacy === 'private' ? '私密' : '',
        dateRangeText: this.formatDateRange(item)
      }
    },

    getCategoryFilters() {
      const cachedCategories = wx.getStorageSync(CATEGORY_STORAGE_KEY)
      const categories = Array.isArray(cachedCategories) ? cachedCategories : DEFAULT_CATEGORIES
      return ['全部', ...categories]
    },
  
    loadRecords() {
      const filters = this.getCategoryFilters()
      const currentFilter = filters.includes(this.data.currentFilter) ? this.data.currentFilter : '全部'
      const records = (wx.getStorageSync('records') || []).map(item => this.decorateRecord(item))
  
      this.setData({
        filters,
        currentFilter,
        allRecords: records
      }, () => {
        this.filterRecords()
      })
    },

    formatDateRange(record) {
      if (record.endDate && record.endDate !== record.date) {
        return `${record.date} 至 ${record.endDate}`
      }

      return record.date || ''
    },
  
    onSearchInput(e) {
      const keyword = e.detail.value.trim()
  
      this.setData({
        keyword
      })
  
      this.filterRecords()
    },
  
    changeFilter(e) {
      const name = e.currentTarget.dataset.name
  
      this.setData({
        currentFilter: name
      })
  
      this.filterRecords()
    },
  
    filterRecords() {
      const { keyword, currentFilter, allRecords } = this.data
  
      let list = allRecords
  
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
          ]
            .join(' ')
            .toLowerCase()
  
          return text.includes(searchText)
        })
      }
  
      this.setData({
        records: list
      })
    },
  
    goTimeline() {
      wx.navigateTo({
        url: '/pages/timeline/timeline'
      })
    },

    goMergeExport() {
      wx.navigateTo({
        url: '/pages/export/export'
      })
    },

    openMoreMenu() {
        wx.showActionSheet({
          itemList: [
            '筛选合并导出',
            '生成长图资料包',
            '图片转文字 OCR',
            '标签管理',
            '关于迹录册'
          ],
          success: res => {
            const index = res.tapIndex
      
            if (index === 0) {
              this.goMergeExport()
            }

            if (index === 1) {
              wx.showToast({
                title: '请进入某条记录详情页生成资料包',
                icon: 'none'
              })
            }
      
            if (index === 2) {
              wx.showToast({
                title: 'OCR功能下一步开发',
                icon: 'none'
              })
            }
      
            if (index === 3) {
              wx.showToast({
                title: '标签管理功能开发中',
                icon: 'none'
              })
            }
      
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
  
      goAdd() {
        wx.navigateTo({
          url: '/pages/add/add'
        })
      },
  
    goDetail(e) {
      const id = e.currentTarget.dataset.id
  
      wx.navigateTo({
        url: `/pages/detail/detail?id=${id}`
      })
    }
  })