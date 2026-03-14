# MoFA FM API Skill

MoFA FM 播客平台 API 的封装和工具集。

## 快速开始

```bash
# 1. 健康检查
python tools/fm_client.py health

# 2. 获取 B 站热搜
python tools/fm_client.py trending --source bilibili

# 3. 搜索播客
python tools/fm_client.py search --query "AI"
```

## 目录结构

```
mofa-fm-api/
├── SKILL.md                    # Skill 定义文档
├── README.md                   # 本文件
├── tools/
│   └── fm_client.py           # Python API 客户端 + CLI
└── examples/
    ├── basic_usage.py         # 基础使用示例
    └── content_creation_workflow.md  # 内容创作工作流
```

## API 覆盖

- ✅ 认证 (注册/登录/用户信息)
- ✅ 节目 (列表/详情/创建/更新/删除)
- ✅ 单集 (列表/详情/创建/播放)
- ✅ 热搜 (56 个数据源)
- ✅ 搜索 (关键词/建议/热门)
- ✅ 互动 (评论/点赞/关注)
- ✅ 创作者 (我的节目/生成队列)

## Python 使用

```python
from fm_client import MoFAFMClient

client = MoFAFMClient()

# 公开 API
shows = client.list_shows()
trending = client.get_trending("bilibili")
results = client.search("AI")

# 需要认证
client.login("username", "password")
me = client.me()
my_shows = client.my_shows()
```

## 文档

- API 文档: https://mofa.fm/swagger/
- ReDoc: https://mofa.fm/redoc/
