Page({
    data: {
      id: '',
      record: null,
  
      currentProofType: '现场照片',
  
      proofTypes: [
        '现场照片',
        '工牌证件',
        '合影',
        '聊天记录',
        '合同',
        '付款记录',
        '证书',
        '邮件'
      ]
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
  
      this.setData({
        record
      })
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
          
    
  
    selectProofType(e) {
      this.setData({
        currentProofType: e.currentTarget.dataset.value
      })
    },
  
    addMaterial() {
      wx.chooseMedia({
        count: 9,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: res => {
          const newFiles = res.tempFiles.map(file => ({
            id: Date.now() + '_' + Math.random().toString(36).slice(2),
            path: file.tempFilePath,
            type: this.data.currentProofType,
            name: this.data.currentProofType
          }))
  
          const record = {
            ...this.data.record
          }
  
          record.files = (record.files || []).concat(newFiles)
          record.cover = record.files.length > 0 ? record.files[0].path : ''
          record.photoCount = record.files.length
          record.proofSummary = this.buildProofSummary(record.files)
          record.updatedAt = new Date().toISOString()
  
          this.updateRecord(record)
  
          wx.showToast({
            title: '已添加',
            icon: 'success'
          })
        },
        fail: err => {
          console.log('选择图片失败：', err)
  
          wx.showToast({
            title: '没有选择图片',
            icon: 'none'
          })
        }
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
  
    deleteMaterial(e) {
      const index = e.currentTarget.dataset.index
      const record = {
        ...this.data.record
      }
  
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这项证明材料吗？',
        confirmText: '删除',
        confirmColor: '#A23B2A',
        success: res => {
          if (res.confirm) {
            record.files.splice(index, 1)
  
            record.cover = record.files.length > 0 ? record.files[0].path : ''
            record.photoCount = record.files.length
            record.proofSummary = this.buildProofSummary(record.files)
            record.updatedAt = new Date().toISOString()
  
            this.updateRecord(record)
  
            wx.showToast({
              title: '已删除',
              icon: 'success'
            })
          }
        }
      })
    },
  
    buildProofSummary(files) {
      const map = {}
  
      files.forEach(file => {
        map[file.type] = (map[file.type] || 0) + 1
      })
  
      return Object.keys(map).map(key => ({
        name: key,
        count: map[key]
      }))
    },
  
    updateRecord(updatedRecord) {
      const records = wx.getStorageSync('records') || []
  
      const newRecords = records.map(item => {
        if (item.id === updatedRecord.id) {
          return updatedRecord
        }
  
        return item
      })
  
      wx.setStorageSync('records', newRecords)
  
      this.setData({
        record: updatedRecord
      })
    },
  
    generateProof() {
        wx.navigateTo({
          url: `/pages/proof/proof?id=${this.data.record.id}`
        })
      }
  })