Page({
    data: {
      keyword: '',
      currentFilter: '全部',
      filters: ['全部', '工作', '学习', '活动', '文件'],
  
      allRecords: [],
      records: []
    },
  
    onShow() {
      this.loadRecords()
    },
  
    loadRecords() {
      const records = wx.getStorageSync('records') || []
  
      this.setData({
        allRecords: records,
        records
      })
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
        list = list.filter(item => {
          if (currentFilter === '工作') {
            return ['展会', '兼职', '实习', '项目'].includes(item.category)
          }
  
          if (currentFilter === '学习') {
            return ['培训', '证书', '课程'].includes(item.category)
          }
  
          if (currentFilter === '活动') {
            return ['展会', '志愿', '社团'].includes(item.category)
          }
  
          if (currentFilter === '文件') {
            return ['合同', '证书', '文件'].includes(item.category)
          }
  
          return true
        })
      }
  
      const searchText = (keyword || '').trim().toLowerCase()
  
      if (searchText) {
        list = list.filter(item => {
          const text = [
            item.title || '',
            item.date || '',
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