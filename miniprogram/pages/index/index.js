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

    getCategoryFilters() {
      const cachedCategories = wx.getStorageSync(CATEGORY_STORAGE_KEY)
      const categories = Array.isArray(cachedCategories) ? cachedCategories : DEFAULT_CATEGORIES
      return ['全部', ...categories]
    },
  
    loadRecords() {
      const filters = this.getCategoryFilters()
      const currentFilter = filters.includes(this.data.currentFilter) ? this.data.currentFilter : '全部'
      const records = (wx.getStorageSync('records') || []).map(item => ({
        ...item,
        dateRangeText: this.formatDateRange(item)
      }))
  
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

    openMoreMenu() {
        wx.showActionSheet({
          itemList: [
            '生成长图资料包',
            '图片转文字 OCR',
            '标签管理',
            '关于有迹'
          ],
          success: res => {
            const index = res.tapIndex
      
            if (index === 0) {
              wx.showToast({
                title: '请进入某条记录详情页生成资料包',
                icon: 'none'
              })
            }
      
            if (index === 1) {
              wx.showToast({
                title: 'OCR功能下一步开发',
                icon: 'none'
              })
            }
      
            if (index === 2) {
              wx.showToast({
                title: '标签管理功能开发中',
                icon: 'none'
              })
            }
      
            if (index === 3) {
              wx.showModal({
                title: '关于有迹',
                content: '有迹是一个帮助你记录、整理和导出经历资料的工具。',
                showCancel: false
              })
            }
          }
        })
      },
  
      goAdd() {
        console.log('点击了新增经历按钮')
      
        wx.showToast({
          title: '点到了',
          icon: 'none'
        })
      
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