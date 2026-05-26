const LOGO_PATH = '/images/logo-square.png'
const FOOTER_COPY = '本资料包由迹录册根据用户上传材料自动整理生成，让每一段经历，都有迹可循。'

Page({
  data: {
    id: '',
    record: null,
    today: ''
  },

  onLoad(options) {
    const today = this.formatDate(new Date())

    this.setData({
      id: options.id || '',
      today
    })

    if (options.id) {
      this.loadRecord(options.id)
    }
  },

  loadRecord(id) {
    const records = wx.getStorageSync('records') || []
    const record = records.find(item => item.id === id)

    /*console.log('从本地缓存读取到的records：', records)
    console.log('当前资料包record：', record)
    console.log('当前record.files：', record ? record.files : null)*/

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

    const displayRecord = this.buildPreviewRecord(record)

    this.setData({
      record: displayRecord
    })

    this.preparePreviewFiles(displayRecord)
  },

  buildPreviewRecord(record) {
    const files = Array.isArray(record.files)
      ? record.files.map(item => ({
          ...item,
          previewPath: item.previewPath || item.canvasPath || item.drawPath || item.tempPath || item.path || ''
        }))
      : []

    return {
      ...record,
      files,
      dateRangeText: this.formatDateRange(record)
    }
  },

  async preparePreviewFiles(record) {
    const files = Array.isArray(record.files) ? record.files : []

    if (!files.length) return

    const nextFiles = await Promise.all(files.map(async item => {
      const localPath = item.tempPath || item.canvasPath || item.drawPath || item.previewPath

      if (localPath && !this.isCloudFilePath(localPath)) {
        return {
          ...item,
          previewPath: localPath
        }
      }

      if (!this.isCloudFilePath(item.path)) {
        return {
          ...item,
          previewPath: item.path || localPath || ''
        }
      }

      try {
        const result = await wx.cloud.downloadFile({
          fileID: item.path
        })

        return {
          ...item,
          previewPath: result.tempFilePath || item.previewPath || item.path
        }
      } catch (error) {
        console.error('资料包预览图片下载失败：', error)
        return item
      }
    }))

    this.setData({
      record: {
        ...record,
        files: nextFiles
      }
    })
  },

  formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')

    return `${y}-${m}-${d}`
  },

  formatDateRange(record) {
    if (record && record.endDate && record.endDate !== record.date) {
      return `${record.date || ''} 至 ${record.endDate}`
    }

    return (record && record.date) || ''
  },

  goBack() {
    if (this.data.id) {
      wx.redirectTo({
        url: `/pages/detail/detail?id=${this.data.id}`
      })
    } else {
      wx.redirectTo({
        url: '/pages/index/index'
      })
    }
  },

  async generateWord() {
    if (!this.data.record) {
      wx.showToast({
        title: '暂无记录',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '生成Word中…',
      mask: true
    })

    try {
      const rawRecord = this.data.record || {}

      // 规范化图片数据，确保传给云函数的是它能识别的格式
      const normalizedFiles = Array.isArray(rawRecord.files)
        ? rawRecord.files
            .map(item => ({
              type: item.type || item.name || '材料',
              path: item.path || item.fileID || item.url || ''
            }))
            .filter(item => item.path)
        : []

      // 规范化 record，避免字段缺失导致生成效果异常
      const record = {
        title: rawRecord.title || '未命名记录',
        date: rawRecord.date || '',
        endDate: rawRecord.endDate || '',
        dateRangeText: this.formatDateRange(rawRecord),
        category: rawRecord.category || '',
        location: rawRecord.location || '',
        role: rawRecord.role || '',
        description: rawRecord.description || '',
        tags: Array.isArray(rawRecord.tags) ? rawRecord.tags : [],
        proofSummary: Array.isArray(rawRecord.proofSummary) ? rawRecord.proofSummary : [],
        files: normalizedFiles
      }

      /*console.log('传给 generateWord 云函数的 record：', record)*/

      const result = await wx.cloud.callFunction({
        name: 'generateWord',
        data: { record }
      })

      wx.hideLoading()

      if (!result.result || !result.result.success) {
        wx.showToast({
          title: result.result?.error || '生成失败',
          icon: 'none'
        })
        return
      }

      const fileID = result.result.fileID

      const downloadResult = await wx.cloud.downloadFile({ fileID })

      wx.openDocument({
        filePath: downloadResult.tempFilePath,
        fileType: 'docx',
        showMenu: true,
        success: () => {
          wx.showToast({
            title: '已生成Word',
            icon: 'success'
          })
        },
        fail: (err) => {
          console.error('打开 Word 失败：', err)
          wx.showToast({
            title: '请在文件管理中查看',
            icon: 'none'
          })
        }
      })

    } catch (e) {
      wx.hideLoading()
      console.error('生成 Word 失败：', e)
      wx.showToast({
        title: '生成失败，请重试',
        icon: 'none'
      })
    }
  },
  showTip() {
    wx.showModal({
      title: '使用说明',
      content: '点击“保存为长图”后，小程序会生成一张资料包图片并保存到你的手机相册。首次保存需要授权相册权限。',
      showCancel: false
    })
  },

  async saveAsImage() {
    if (!this.data.record) {
      wx.showToast({
        title: '暂无记录',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '生成中...',
      mask: true
    })

    let timeoutTimer = null

    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutTimer = setTimeout(() => {
          reject(new Error('生成超时，请重新进入页面后再试'))
        }, 25000)
      })

      const recordForCanvas = await this.prepareFilesForCanvas(this.data.record)

      this.setData({
        record: recordForCanvas
      })

      const filePath = await Promise.race([
        this.drawProofImage(recordForCanvas),
        timeoutPromise
      ])

      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
      }

      wx.hideLoading()

      await this.saveImageToAlbum(filePath)

      wx.showToast({
        title: '已保存到相册',
        icon: 'success'
      })
    } catch (err) {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
      }

      console.error('保存长图失败：', err)

      wx.hideLoading()
      wx.showModal({
        title: '保存失败',
        content: String(err.message || err.errMsg || '长图生成失败，请重新进入页面后再试。'),
        showCancel: false
      })
    }
  },

  async prepareFilesForCanvas(record) {
    const files = Array.isArray(record.files) ? record.files : []

    if (!files.length) {
      return record
    }

    const nextFiles = await Promise.all(files.map(async item => {
      const existingPath = item.tempPath || item.canvasPath || item.drawPath || item.previewPath

      if (existingPath && !this.isCloudFilePath(existingPath)) {
        return {
          ...item,
          canvasPath: existingPath,
          drawPath: existingPath,
          previewPath: item.previewPath || existingPath
        }
      }

      if (this.isCloudFilePath(item.path)) {
        try {
          const result = await wx.cloud.downloadFile({
            fileID: item.path
          })
          const tempFilePath = result.tempFilePath || ''

          return {
            ...item,
            canvasPath: tempFilePath,
            drawPath: tempFilePath,
            previewPath: item.previewPath || tempFilePath || item.path
          }
        } catch (error) {
          console.error('长图材料图片下载失败：', error)
          return item
        }
      }

      const directPath = item.path || ''

      return {
        ...item,
        canvasPath: directPath,
        drawPath: directPath,
        previewPath: item.previewPath || directPath
      }
    }))

    return {
      ...record,
      files: nextFiles,
      dateRangeText: this.formatDateRange(record)
    }
  },

  isCloudFilePath(path) {
    return typeof path === 'string' && path.indexOf('cloud://') === 0
  },

  getFileDrawPath(file) {
    if (!file) return ''

    return file.canvasPath || file.drawPath || file.previewPath || file.tempPath || file.path || ''
  },

  getDescriptionText(description) {
    const text = String(description || '').trim()
    return text && text !== '暂无备注' ? text : '暂无备注'
  },

  getDescriptionBoxHeight(lineCount) {
    return Math.max(88, lineCount * 42 + 56)
  },

  drawProofImage(recordForCanvas) {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery()

      query
        .select('#proofCanvas')
        .fields({
          node: true,
          size: true
        })
        .exec(async res => {
          try {
            if (!res || !res[0] || !res[0].node) {
              reject(new Error('未找到 canvas 节点，请检查 proof.wxml 里的 proofCanvas'))
              return
            }

            const canvas = res[0].node
            const ctx = canvas.getContext('2d')
            const dpr = wx.getSystemInfoSync().pixelRatio || 2
            const width = 750

            const record = recordForCanvas || this.data.record || {}
            const files = record.files || []
            const tags = record.tags || []
            const proofSummary = record.proofSummary || []

            const contentX = 82
            const contentW = 586
            const cardX = 32
            const cardW = width - cardX * 2
            const descriptionText = this.getDescriptionText(record.description)
            const dateRangeText = record.dateRangeText || this.formatDateRange(record) || '未填写日期'

            ctx.font = '27px sans-serif'
            const descriptionLines = this.getWrappedLines(ctx, descriptionText, contentW - 48, 3)
            const descriptionBoxH = this.getDescriptionBoxHeight(descriptionLines.length)

            // 估算高度：基础区 + 动态备注区 + 图片区 + 底部
            const restCount = Math.max(0, files.length - 1)
            const restRows = restCount > 0 ? Math.ceil(restCount / 2) : 0

            let estimatedHeight = 1220 + descriptionBoxH

            if (files.length > 0) {
              estimatedHeight += 390
            }

            if (restRows > 0) {
              estimatedHeight += restRows * 290
            }

            if (tags.length > 6) {
              estimatedHeight += 80
            }

            estimatedHeight = Math.max(1400, estimatedHeight)

            canvas.width = width * dpr
            canvas.height = estimatedHeight * dpr
            ctx.scale(dpr, dpr)

            // 背景
            ctx.fillStyle = '#F6F2EA'
            ctx.fillRect(0, 0, width, estimatedHeight)

            // 主卡片
            this.roundRect(ctx, cardX, 32, cardW, estimatedHeight - 64, 34, '#FFFFFF')

            // 顶部装饰区
            this.roundRect(ctx, cardX, 32, cardW, 330, 34, '#DDECE7')

            let y = 118

            // Logo
            await this.drawLogoToCanvas(canvas, ctx, LOGO_PATH, contentX, y, 66, 66, 18)

            ctx.textAlign = 'left'
            ctx.textBaseline = 'alphabetic'

            // 品牌
            ctx.fillStyle = '#294C60'
            ctx.font = 'bold 34px sans-serif'
            ctx.fillText('迹录册', contentX + 84, y + 28)

            ctx.fillStyle = '#6C6A64'
            ctx.font = '22px sans-serif'
            ctx.fillText('Experience Archive Card', contentX + 84, y + 58)

            // 右上角时间
            ctx.fillStyle = '#294C60'
            ctx.font = '22px sans-serif'
            ctx.textAlign = 'right'
            ctx.fillText(`Generated ${this.data.today}`, 668, y + 22)
            ctx.textAlign = 'left'

            y += 126

            // 标题
            ctx.fillStyle = '#202124'
            ctx.font = 'bold 42px sans-serif'
            y = this.drawWrappedText(ctx, record.title || '未命名记录', contentX, y, contentW, 56, 2)

            // 进入内容区。顶部只保留品牌和标题，日期/分类/地点/身份放在基本信息里。
            y = Math.max(370, y + 30)

            // 基本信息卡
            this.roundRect(ctx, contentX, y, contentW, 230, 26, '#F8F6F1')

            ctx.fillStyle = '#294C60'
            ctx.font = 'bold 30px sans-serif'
            ctx.fillText('基本信息', contentX + 24, y + 44)

            const infoRows = [
              ['时间', dateRangeText || '未填写'],
              ['地点', record.location || '未填写地点'],
              ['分类', record.category || '未填写分类'],
              ['身份', record.role || '未填写身份']
            ]

            infoRows.forEach((row, index) => {
              const rowY = y + 86 + index * 34

              ctx.fillStyle = '#77746E'
              ctx.font = '24px sans-serif'
              ctx.fillText(row[0], contentX + 28, rowY)

              ctx.fillStyle = '#202124'
              ctx.font = 'bold 26px sans-serif'
              this.drawWrappedText(ctx, String(row[1]), contentX + 108, rowY, 420, 30, 1)
            })

            y += 280

            // 经历说明
            ctx.fillStyle = '#294C60'
            ctx.font = 'bold 32px sans-serif'
            ctx.fillText('经历说明', contentX, y)

            y += 28

            const descriptionBoxY = y
            this.roundRect(ctx, contentX, descriptionBoxY, contentW, descriptionBoxH, 24, '#F8F6F1')

            ctx.fillStyle = '#202124'
            ctx.font = '27px sans-serif'
            this.drawWrappedText(ctx, descriptionText, contentX + 24, descriptionBoxY + 46, contentW - 48, 42, 3)

            y = descriptionBoxY + descriptionBoxH + 50

            // 标签
            if (tags.length > 0) {
              ctx.fillStyle = '#294C60'
              ctx.font = 'bold 32px sans-serif'
              ctx.fillText('标签', contentX, y)

              y += 32

              let tagX = contentX
              let tagY = y
              const drawTags = tags.slice(0, 12)

              drawTags.forEach(tag => {
                const text = String(tag)
                ctx.font = '23px sans-serif'
                const tagW = Math.min(180, ctx.measureText(text).width + 38)

                if (tagX + tagW > contentX + contentW) {
                  tagX = contentX
                  tagY += 50
                }

                this.roundRect(ctx, tagX, tagY, tagW, 36, 18, '#E9DED0')

                ctx.fillStyle = '#7A4F2A'
                ctx.font = '23px sans-serif'
                ctx.fillText(text.slice(0, 8), tagX + 19, tagY + 25)

                tagX += tagW + 14
              })

              y = tagY + 70
            }

            // 材料概览
            ctx.fillStyle = '#294C60'
            ctx.font = 'bold 32px sans-serif'
            ctx.fillText('材料概览', contentX, y)

            y += 36

            const summaryText = proofSummary.length > 0
              ? proofSummary.map(item => `${item.name}${item.count}份`).join('，')
              : '暂无材料'

            ctx.fillStyle = '#202124'
            ctx.font = '27px sans-serif'
            y = this.drawWrappedText(ctx, summaryText, contentX, y, contentW, 42, 3)

            y += 50

            // 图片区
            if (files.length > 0) {
              ctx.fillStyle = '#294C60'
              ctx.font = 'bold 32px sans-serif'
              ctx.fillText('材料图片', contentX, y)

              y += 34

              // 第一张大图
              const firstFile = files[0]
              await this.drawImageToCanvas(canvas, ctx, this.getFileDrawPath(firstFile), contentX, y, contentW, 330)
              this.drawImageLabel(ctx, contentX + 16, y + 278, firstFile.type || '材料')

              y += 370

              // 后续图片两列
              const restFiles = files.slice(1)

              if (restFiles.length > 0) {
                const imgW = 282
                const imgH = 212
                const gapX = 22
                const gapY = 74

                for (let i = 0; i < restFiles.length; i++) {
                  const col = i % 2
                  const row = Math.floor(i / 2)
                  const x = contentX + col * (imgW + gapX)
                  const imgY = y + row * (imgH + gapY)

                  await this.drawImageToCanvas(canvas, ctx, this.getFileDrawPath(restFiles[i]), x, imgY, imgW, imgH)
                  this.drawImageLabel(ctx, x + 14, imgY + imgH - 42, restFiles[i].type || '材料')
                }

                const restRows = Math.ceil(restFiles.length / 2)
                y += restRows * (imgH + gapY)
              }

              y += 28
            }

            // 底部说明
            y += 26

            ctx.strokeStyle = '#E5E1DA'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(contentX, y)
            ctx.lineTo(contentX + contentW, y)
            ctx.stroke()

            y += 46

            ctx.fillStyle = '#77746E'
            ctx.font = '22px sans-serif'
            ctx.fillText(`生成时间：${this.data.today}`, contentX, y)

            y += 42

            ctx.fillStyle = '#99938A'
            ctx.font = '20px sans-serif'
            this.drawWrappedText(
              ctx,
              FOOTER_COPY,
              contentX,
              y,
              contentW,
              32,
              3
            )

            wx.canvasToTempFilePath({
              canvas,
              x: 0,
              y: 0,
              width,
              height: estimatedHeight,
              destWidth: width * dpr,
              destHeight: estimatedHeight * dpr,
              success: result => {
                resolve(result.tempFilePath)
              },
              fail: err => {
                reject(err)
              }
            })
          } catch (error) {
            reject(error)
          }
        })
    })
  },

  saveImageToAlbum(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: resolve,
        fail: err => {
          if (err.errMsg && err.errMsg.includes('auth deny')) {
            wx.openSetting({
              success: () => reject(err),
              fail: reject
            })
          } else {
            reject(err)
          }
        }
      })
    })
  },

  drawLogoToCanvas(canvas, ctx, src, x, y, w, h, r) {
    return new Promise(resolve => {
      let finished = false

      const finish = () => {
        if (!finished) {
          finished = true
          resolve()
        }
      }

      const fallback = () => {
        this.roundRect(ctx, x, y, w, h, r, '#294C60')
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 32px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('迹', x + w / 2, y + h / 2)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        finish()
      }

      const timer = setTimeout(fallback, 2000)
      const img = canvas.createImage()

      img.onload = () => {
        if (finished) return
        clearTimeout(timer)

        ctx.save()
        this.roundRectPath(ctx, x, y, w, h, r)
        ctx.clip()
        ctx.drawImage(img, x, y, w, h)
        ctx.restore()

        finish()
      }

      img.onerror = () => {
        if (finished) return
        clearTimeout(timer)
        fallback()
      }

      img.src = src
    })
  },

  drawImageToCanvas(canvas, ctx, src, x, y, w, h) {
    return new Promise(resolve => {
      let finished = false

      const finish = () => {
        if (!finished) {
          finished = true
          resolve()
        }
      }

      if (!src) {
        this.roundRect(ctx, x, y, w, h, 18, '#F1F0EC')
        ctx.fillStyle = '#77746E'
        ctx.font = '22px sans-serif'
        ctx.fillText('图片加载失败', x + 76, y + h / 2)
        finish()
        return
      }

      const timer = setTimeout(() => {
        this.roundRect(ctx, x, y, w, h, 18, '#F1F0EC')

        ctx.fillStyle = '#77746E'
        ctx.font = '22px sans-serif'
        ctx.fillText('图片加载超时', x + 76, y + h / 2)

        finish()
      }, 3000)

      const img = canvas.createImage()

      img.onload = () => {
        if (finished) return

        clearTimeout(timer)

        ctx.save()

        this.roundRectPath(ctx, x, y, w, h, 18)
        ctx.clip()

        const ratio = Math.max(w / img.width, h / img.height)
        const drawW = img.width * ratio
        const drawH = img.height * ratio
        const drawX = x + (w - drawW) / 2
        const drawY = y + (h - drawH) / 2

        ctx.drawImage(img, drawX, drawY, drawW, drawH)

        ctx.restore()

        finish()
      }

      img.onerror = () => {
        if (finished) return

        clearTimeout(timer)

        this.roundRect(ctx, x, y, w, h, 18, '#F1F0EC')

        ctx.fillStyle = '#77746E'
        ctx.font = '22px sans-serif'
        ctx.fillText('图片加载失败', x + 76, y + h / 2)

        finish()
      }

      img.src = src
    })
  },

  drawImageLabel(ctx, x, y, text) {
    const labelText = String(text || '材料')
    ctx.font = '20px sans-serif'
    const labelW = Math.min(160, ctx.measureText(labelText).width + 34)

    this.roundRect(ctx, x, y, labelW, 30, 15, 'rgba(32,33,36,0.68)')

    ctx.fillStyle = '#FFFFFF'
    ctx.font = '20px sans-serif'
    ctx.fillText(labelText.slice(0, 8), x + 16, y + 21)
  },

  roundRect(ctx, x, y, w, h, r, color) {
    ctx.save()
    ctx.fillStyle = color
    this.roundRectPath(ctx, x, y, w, h, r)
    ctx.fill()
    ctx.restore()
  },

  roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  },

  getWrappedLines(ctx, text, maxWidth, maxLines) {
    const str = String(text || '')
    let line = ''
    let lines = []
    const chars = str.split('')

    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i]
      const testWidth = ctx.measureText(testLine).width

      if (testWidth > maxWidth && line) {
        lines.push(line)
        line = chars[i]
      } else {
        line = testLine
      }
    }

    if (line) {
      lines.push(line)
    }

    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines)
      const lastIndex = lines.length - 1
      lines[lastIndex] = lines[lastIndex].slice(0, Math.max(0, lines[lastIndex].length - 1)) + '…'
    }

    return lines.length > 0 ? lines : ['']
  },

  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const lines = this.getWrappedLines(ctx, text, maxWidth, maxLines)

    lines.forEach((item, index) => {
      ctx.fillText(item, x, y + index * lineHeight)
    })

    return y + lines.length * lineHeight
  }
})