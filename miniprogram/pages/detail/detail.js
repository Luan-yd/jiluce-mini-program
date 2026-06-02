Page({
    data: {
      id: '',
      record: null
    },
  
    onLoad(options) {
      this.setData({
        id: options.id
      })
  
      this.loadRecord(options.id)
    },
  
    onShow() {
      if (this.data.id) {
        this.loadRecord(this.data.id)
      }
    },

    normalizePrivacy(value) {
      const privateValues = ['private', 'encrypted', 'export_confirm', 'locked']
      return privateValues.includes(value) ? 'private' : 'normal'
    },
  
    loadRecord(id) {
      const records = wx.getStorageSync('records') || []
      const record = records.find(item => item.id === id)
  
      if (!record) {
        wx.showToast({
          title: '记录不存在',
          icon: 'none'
        })
  
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/index/index'
          })
        }, 800)
  
        return
      }

      const privacy = this.normalizePrivacy(record.privacy)
  
      this.setData({
        record: {
          ...record,
          privacy,
          isPrivate: privacy === 'private',
          dateRangeText: this.formatDateRange(record)
        }
      })
    },

    formatDateRange(record) {
      if (record.endDate && record.endDate !== record.date) {
        return `${record.date} 至 ${record.endDate}`
      }

      return record.date || ''
    },
  
    goBack() {
      wx.redirectTo({
        url: '/pages/index/index'
      })
    },
  
    editRecord() {
      wx.navigateTo({
        url: `/pages/add/add?id=${this.data.record.id}`
      })
    },

    goList() {
      wx.switchTab({
        url: '/pages/index/index'
      })
    },
  
    deleteRecord() {
      wx.showModal({
        title: '删除记录',
        content: '确定要删除这条记录吗？删除后不可恢复。',
        confirmText: '删除',
        confirmColor: '#B24A3B',
        success: res => {
          if (!res.confirm) return
    
          const id = this.data.id
          const records = wx.getStorageSync('records') || []
          const newRecords = records.filter(item => item.id !== id)
    
          wx.setStorageSync('records', newRecords)
    
          wx.showToast({
            title: '已删除',
            icon: 'success'
          })
    
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/index/index'
            })
          }, 600)
        }
      })
    },

    previewHeroImage(e) {
      const index = e.currentTarget.dataset.index
      const urls = (this.data.record.files || []).map(item => item.tempPath || item.path)
  
      wx.previewImage({
        current: urls[index],
        urls
      })
    },
  
    previewImage(e) {
      const index = e.currentTarget.dataset.index
      const urls = (this.data.record.files || []).map(item => item.path)
  
      wx.previewImage({
        current: urls[index],
        urls
      })
    },
  
    generateProof() {
        wx.navigateTo({
          url: `/pages/proof/proof?id=${this.data.record.id}`
        })
      }
  })