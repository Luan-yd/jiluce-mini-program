const DEFAULT_CATEGORIES = ['项目', '实习', '旅游', '记忆', '其他']
const DEFAULT_PROOF_TYPES = ['现场照片', '工牌证件', '合影', '聊天记录', '合同', '付款记录', '证书', '邮件']
const CATEGORY_STORAGE_KEY = 'customCategories'
const PROOF_TYPE_STORAGE_KEY = 'customProofTypes'

Page({
    data: {
      isEdit: false,
      editId: '',
  
      tagInput: '',
  
      categories: DEFAULT_CATEGORIES,
  
      proofTypes: DEFAULT_PROOF_TYPES,
  
      currentProofType: DEFAULT_PROOF_TYPES[0],
  
      files: [],
  
      form: {
        title: '',
        date: '',
        location: '',
        category: DEFAULT_CATEGORIES[0],
        role: '',
        description: '',
        tags: [],
        privacy: 'exportable'
      }
    },
  
    onLoad(options) {
      this.initManagedLists()

      if (options.id) {
        this.loadEditRecord(options.id)
      }
    },

    initManagedLists() {
      const cachedCategories = wx.getStorageSync(CATEGORY_STORAGE_KEY)
      const cachedProofTypes = wx.getStorageSync(PROOF_TYPE_STORAGE_KEY)
      const categories = Array.isArray(cachedCategories) ? cachedCategories : DEFAULT_CATEGORIES
      const proofTypes = Array.isArray(cachedProofTypes) ? cachedProofTypes : DEFAULT_PROOF_TYPES

      this.setData({
        categories,
        proofTypes,
        'form.category': categories[0] || '',
        currentProofType: proofTypes[0] || ''
      })
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
          category: record.category || '',
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

    addCategory() {
      wx.showModal({
        title: '新增分类',
        editable: true,
        placeholderText: '请输入分类名称',
        success: res => {
          if (!res.confirm) return

          const value = (res.content || '').trim()

          if (!value) {
            wx.showToast({
              title: '分类不能为空',
              icon: 'none'
            })
            return
          }

          if (this.data.categories.includes(value)) {
            wx.showToast({
              title: '分类已存在',
              icon: 'none'
            })
            return
          }

          const categories = [...this.data.categories, value]
          wx.setStorageSync(CATEGORY_STORAGE_KEY, categories)

          this.setData({
            categories,
            'form.category': this.data.form.category || value
          })
        }
      })
    },

    deleteCategory(e) {
      const value = e.currentTarget.dataset.value

      wx.showModal({
        title: '删除分类',
        content: `确定要删除“${value}”吗？已保存记录中的分类文字不会受影响。`,
        confirmText: '删除',
        confirmColor: '#B24A3B',
        success: res => {
          if (!res.confirm) return

          const categories = this.data.categories.filter(item => item !== value)
          const nextCategory = this.data.form.category === value ? (categories[0] || '') : this.data.form.category

          wx.setStorageSync(CATEGORY_STORAGE_KEY, categories)

          this.setData({
            categories,
            'form.category': nextCategory
          })
        }
      })
    },

    addProofType() {
      wx.showModal({
        title: '新增材料类型',
        editable: true,
        placeholderText: '请输入材料类型名称',
        success: res => {
          if (!res.confirm) return

          const value = (res.content || '').trim()

          if (!value) {
            wx.showToast({
              title: '材料类型不能为空',
              icon: 'none'
            })
            return
          }

          if (this.data.proofTypes.includes(value)) {
            wx.showToast({
              title: '材料类型已存在',
              icon: 'none'
            })
            return
          }

          const proofTypes = [...this.data.proofTypes, value]
          wx.setStorageSync(PROOF_TYPE_STORAGE_KEY, proofTypes)

          this.setData({
            proofTypes,
            currentProofType: this.data.currentProofType || value
          })
        }
      })
    },

    deleteProofType(e) {
      const value = e.currentTarget.dataset.value

      wx.showModal({
        title: '删除材料类型',
        content: `确定要删除“${value}”吗？已保存材料上的类型文字不会受影响。`,
        confirmText: '删除',
        confirmColor: '#B24A3B',
        success: res => {
          if (!res.confirm) return

          const proofTypes = this.data.proofTypes.filter(item => item !== value)
          const nextProofType = this.data.currentProofType === value ? (proofTypes[0] || '') : this.data.currentProofType

          wx.setStorageSync(PROOF_TYPE_STORAGE_KEY, proofTypes)

          this.setData({
            proofTypes,
            currentProofType: nextProofType
          })
        }
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
      if (!this.data.currentProofType) {
        wx.showToast({
          title: '请先添加材料类型',
          icon: 'none'
        })
        return
      }

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
                path: uploadRes.fileID,
                tempPath: tempFilePath,
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

      if (!form.category) {
        wx.showToast({
          title: '请先添加分类',
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