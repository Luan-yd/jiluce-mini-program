Page({
    data: {
      isEdit: false,
      editId: '',
  
      tagInput: '',
  
      categories: ['展会','记忆','兼职', '志愿', '实习', '项目', '培训', '合同', '证书', '其他'],
  
      proofTypes: [
        '现场照片',
        '工牌证件',
        '合影',
        '聊天记录',
        '合同',
        '付款记录',
        '证书',
        '邮件'
      ],
  
      currentProofType: '现场照片',
  
      files: [],
  
      form: {
        title: '',
        date: '',
        location: '',
        category: '展会',
        role: '',
        description: '',
        tags: [],
        privacy: 'exportable'
      }
    },
  
    onLoad(options) {
      if (options.id) {
        this.loadEditRecord(options.id)
      }
    },
  
    loadEditRecord(id) {
      const records = wx.getStorageSync('records') || []
      const record = records.find(item => item.id === id)
  
      if (!record) {
        wx.showToast({
          title: '记录不存在',
          icon: 'none'
        })
  
        setTimeout(() => {
          wx.navigateBack()
        }, 800)
  
        return
      }
  
      this.setData({
        isEdit: true,
        editId: id,
        files: record.files || [],
        tagInput: (record.tags || []).join('，'),
        form: {
          title: record.title || '',
          date: record.date || '',
          location: record.location || '',
          category: record.category || '展会',
          role: record.role || '',
          description: record.description || '',
          tags: record.tags || [],
          privacy: record.privacy || 'exportable'
        }
      })
    },
  
    goBack() {
      wx.navigateBack()
    },
  
    onInput(e) {
      const field = e.currentTarget.dataset.field
      const value = e.detail.value
  
      this.setData({
        [`form.${field}`]: value
      })
    },
  
    onDateChange(e) {
      this.setData({
        'form.date': e.detail.value
      })
    },
  
    selectCategory(e) {
      this.setData({
        'form.category': e.currentTarget.dataset.value
      })
    },
  
    selectProofType(e) {
      this.setData({
        currentProofType: e.currentTarget.dataset.value
      })
    },
  
    onTagInput(e) {
      const value = e.detail.value
      const tags = value
        .split(/[,，]/)
        .map(item => item.trim())
        .filter(Boolean)
  
      this.setData({
        tagInput: value,
        'form.tags': tags
      })
    },
  
    onPrivacyChange(e) {
      this.setData({
        'form.privacy': e.detail.value
      })
    },
  
    async chooseImage() {
      wx.chooseMedia({
        count: 9,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: async res => {
          wx.showLoading({
            title: '上传图片中...',
            mask: true
          })
    
          try {
            const newFiles = []
    
            for (const file of res.tempFiles) {
              const tempFilePath = file.tempFilePath
              const ext = tempFilePath.split('.').pop() || 'jpg'
              const cloudPath = `proof-images/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    
              const uploadRes = await wx.cloud.uploadFile({
                cloudPath,
                filePath: tempFilePath
              })
    
              newFiles.push({
                id: Date.now() + '_' + Math.random().toString(36).slice(2),
                path: uploadRes.fileID,      // 给云函数生成 Word 用，必须是 cloud://
                tempPath: tempFilePath,      // 给小程序页面本地预览/长图绘制用
                type: this.data.currentProofType,
                name: this.data.currentProofType
              })
            }
    
            this.setData({
              files: [...(this.data.files || []), ...newFiles]
            })
    
            wx.hideLoading()
    
            wx.showToast({
              title: '上传成功',
              icon: 'success'
            })
    
          } catch (err) {
            wx.hideLoading()
            console.error('图片上传失败：', err)
            wx.showToast({
              title: '上传失败',
              icon: 'none'
            })
          }
        },
        fail: err => {
          console.error('选择图片失败：', err)
          wx.showToast({
            title: '未选择图片',
            icon: 'none'
          })
        }
      })
    
           
    },
  
    previewImage(e) {
      const index = e.currentTarget.dataset.index
      const urls = this.data.files.map(item => item.tempPath || item.path)
    
      wx.previewImage({
        current: urls[index],
        urls
      })
    },
  
  
    deleteFile(e) {
      const index = e.currentTarget.dataset.index
      const files = [...this.data.files]
  
      files.splice(index, 1)
  
      this.setData({
        files
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
  
    saveRecord() {
      const form = this.data.form
    
      if (!form.title) {
        wx.showToast({
          title: '请填写标题',
          icon: 'none'
        })
        return
      }
    
      if (!form.date) {
        wx.showToast({
          title: '请选择日期',
          icon: 'none'
        })
        return
      }
    
      const oldRecords = wx.getStorageSync('records') || []
      const files = this.data.files || []
      const proofSummary = this.buildProofSummary(files)
    
      if (this.data.isEdit) {
        const updatedRecords = oldRecords.map(item => {
          if (item.id === this.data.editId) {
            return {
              ...item,
              title: form.title,
              date: form.date,
              location: form.location || '未填写地点',
              category: form.category,
              role: form.role || '未填写身份',
              description: form.description || '暂无备注',
              tags: form.tags,
              privacy: form.privacy,
              files,
              proofSummary,
              cover: files.length > 0 ? (files[0].tempPath || files[0].path) : '',
              photoCount: files.length,
              updatedAt: new Date().toISOString()
            }
          }
    
          return item
        })
    
        wx.setStorageSync('records', updatedRecords)
    
        wx.showToast({
          title: '修改成功',
          icon: 'success'
        })
    
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/detail/detail?id=${this.data.editId}`
          })
        }, 600)
    
        return
      }
    
      const newRecord = {
        id: Date.now().toString(),
        title: form.title,
        date: form.date,
        location: form.location || '未填写地点',
        category: form.category,
        role: form.role || '未填写身份',
        description: form.description || '暂无备注',
        tags: form.tags,
        privacy: form.privacy,
        files,
        proofSummary,
        cover: files.length > 0 ? (files[0].tempPath || files[0].path) : '',
        photoCount: files.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    
      oldRecords.unshift(newRecord)
    
      wx.setStorageSync('records', oldRecords)
    
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
    
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }, 600)
    }
  
  })