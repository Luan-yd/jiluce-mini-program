const cloud = require('wx-server-sdk')
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  ImageRun
} = require('docx')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function safeFileName(name) {
  return String(name || 'record')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 40)
}

function formatDateRange(record) {
  if (record && record.endDate && record.endDate !== record.date) {
    return `${record.date || ''} 至 ${record.endDate}`
  }

  return (record && record.date) || ''
}

async function fetchImageBuffer(filePath) {
  try {
    if (!filePath) {
      console.log('图片路径为空')
      return null
    }

    const path = String(filePath)

    console.log('准备读取图片：', path)

    if (!path.startsWith('cloud://')) {
      console.log('不是云存储 fileID，云函数无法读取：', path)
      return null
    }

    const result = await cloud.downloadFile({
      fileID: path
    })

    if (!result || !result.fileContent) {
      console.log('cloud.downloadFile 没有返回 fileContent：', path)
      return null
    }

    console.log('图片读取成功，大小：', result.fileContent.length)

    return result.fileContent
  } catch (err) {
    console.error('下载图片失败：', filePath, err)
    return null
  }
}

function addTextParagraph(children, text, options = {}) {
  children.push(
    new Paragraph({
      spacing: options.spacing || { after: 200 },
      alignment: options.alignment,
      children: [
        new TextRun({
          text: String(text || ''),
          size: options.size || 24,
          bold: !!options.bold,
          color: options.color
        })
      ]
    })
  )
}

exports.main = async (event) => {
  try {
    const { record } = event

    if (!record) {
      return {
        success: false,
        error: '没有记录数据'
      }
    }

    console.log('generateWord 收到 record：', JSON.stringify(record))
    console.log('generateWord 收到 files：', JSON.stringify(record.files || []))

    const children = []
    const dateText = record.dateRangeText || formatDateRange(record) || '未填写'

    children.push(
      new Paragraph({
        text: '个人经历',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [
          new TextRun({
            text: record.title || '未命名记录',
            bold: true,
            size: 56
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `日期：${dateText}`,
            size: 28
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `分类：${record.category || '未填写'}`,
            size: 28
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `地点：${record.location || '未填写'}`,
            size: 28
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [
          new TextRun({
            text: `身份：${record.role || '未填写'}`,
            size: 28
          })
        ]
      }),
      new Paragraph({
        children: [new PageBreak()]
      })
    )

    children.push(
      new Paragraph({
        text: '经历说明',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
      }),
      new Paragraph({
        spacing: { after: 400 },
        children: [
          new TextRun({
            text: record.description || '暂无说明',
            size: 24
          })
        ]
      })
    )

    if (Array.isArray(record.tags) && record.tags.length > 0) {
      children.push(
        new Paragraph({
          text: '标签',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 }
        }),
        new Paragraph({
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: record.tags.join('  ·  '),
              size: 24
            })
          ]
        })
      )
    }

    if (Array.isArray(record.proofSummary) && record.proofSummary.length > 0) {
      children.push(
        new Paragraph({
          text: '材料概览',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 }
        }),
        new Paragraph({
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: record.proofSummary
                .map(item => `${item.name}${item.count}份`)
                .join('，'),
              size: 24
            })
          ]
        })
      )
    }

    if (Array.isArray(record.files) && record.files.length > 0) {
      children.push(
        new Paragraph({
          children: [new PageBreak()]
        }),
        new Paragraph({
          text: '材料图片',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 300 }
        })
      )

      for (let i = 0; i < record.files.length; i++) {
        const file = record.files[i] || {}
        const fileType = file.type || file.name || `材料${i + 1}`
        const filePath = file.path || file.fileID || file.url || ''

        console.log(`第 ${i + 1} 张图片：`, {
          fileType,
          filePath
        })

        children.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: fileType,
                bold: true,
                size: 22
              })
            ]
          })
        )

        const buf = await fetchImageBuffer(filePath)

        if (buf) {
          children.push(
            new Paragraph({
              spacing: { after: 300 },
              children: [
                new ImageRun({
                  data: buf,
                  type: 'png',
                  transformation: {
                    width: 400,
                    height: 300
                  }
                })
              ]
            })
          )
        } else {
          children.push(
            new Paragraph({
              spacing: { after: 300 },
              children: [
                new TextRun({
                  text: '图片读取失败：该图片可能不是云存储路径，或云函数没有权限读取。请重新上传图片后再导出。',
                  size: 20,
                  color: '888888'
                })
              ]
            })
          )
        }
      }
    } else {
      children.push(
        new Paragraph({
          text: '材料图片',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 }
        }),
        new Paragraph({
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: '暂无图片材料',
              size: 22,
              color: '888888'
            })
          ]
        })
      )
    }

    children.push(
      new Paragraph({
        children: [new PageBreak()]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: '本资料包由迹录册根据用户上传材料自动整理生成，让每一段经历，都有迹可循。',
            size: 22,
            color: '888888'
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `生成时间：${new Date().toLocaleDateString('zh-CN')}`,
            size: 22,
            color: '888888'
          })
        ]
      })
    )

    const doc = new Document({
      sections: [
        {
          children
        }
      ]
    })

    const buffer = await Packer.toBuffer(doc)

    const cloudPath = `word/${Date.now()}_${safeFileName(record.title)}.docx`

    const uploadResult = await cloud.uploadFile({
      cloudPath,
      fileContent: buffer
    })

    return {
      success: true,
      fileID: uploadResult.fileID
    }
  } catch (err) {
    console.error('generateWord 云函数执行失败：', err)

    return {
      success: false,
      error: err.message || '生成 Word 失败'
    }
  }
}
