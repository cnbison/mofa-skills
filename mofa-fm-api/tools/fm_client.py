#!/usr/bin/env python3
"""
MoFA FM API Client

封装 MoFA FM 播客平台 API 的 Python 客户端
"""

import requests
import os
from typing import Optional, Dict, Any, List
from urllib.parse import urljoin


class MoFAFMClient:
    """MoFA FM API 客户端"""

    BASE_URL = "https://mofa.fm/api"

    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token
        self.session = requests.Session()

    def _headers(self, auth: bool = False) -> Dict[str, str]:
        """构建请求头"""
        headers = {"Content-Type": "application/json"}
        if auth and self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

    def _get(self, path: str, auth: bool = False, params: Optional[Dict] = None) -> Dict:
        """GET 请求"""
        url = urljoin(self.BASE_URL + "/", path.lstrip("/"))
        resp = self.session.get(url, headers=self._headers(auth), params=params)
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, data: Dict, auth: bool = False) -> Dict:
        """POST 请求"""
        url = urljoin(self.BASE_URL + "/", path.lstrip("/"))
        resp = self.session.post(url, headers=self._headers(auth), json=data)
        resp.raise_for_status()
        return resp.json()

    # ========== 认证 ==========

    def register(self, username: str, email: str, password: str) -> Dict:
        """用户注册"""
        return self._post("/auth/register/", {
            "username": username,
            "email": email,
            "password": password,
            "password2": password
        })

    def login(self, username: str, password: str) -> Dict:
        """用户登录，返回 tokens"""
        result = self._post("/auth/login/", {
            "username": username,
            "password": password
        })
        if "access" in result:
            self.access_token = result["access"]
        return result

    def me(self) -> Dict:
        """获取当前用户信息"""
        return self._get("/auth/me/", auth=True)

    def become_creator(self) -> Dict:
        """成为创作者"""
        return self._post("/auth/creator/become/", {}, auth=True)

    # ========== 节目 ==========

    def list_shows(self, page: int = 1) -> Dict:
        """获取节目列表"""
        return self._get("/podcasts/shows/", params={"page": page})

    def get_show(self, slug: str) -> Dict:
        """获取节目详情"""
        return self._get(f"/podcasts/shows/{slug}/")

    def create_show(self, title: str, description: str = "", content_type: str = "podcast") -> Dict:
        """创建节目"""
        return self._post("/podcasts/shows/create/", {
            "title": title,
            "description": description,
            "content_type": content_type
        }, auth=True)

    # ========== 单集 ==========

    def list_episodes(self, page: int = 1) -> Dict:
        """获取单集列表"""
        return self._get("/podcasts/episodes/", params={"page": page})

    def get_episode(self, episode_id: int) -> Dict:
        """获取单集详情"""
        return self._get(f"/podcasts/episodes/{episode_id}/", auth=True)

    # ========== 热搜 ==========

    def list_trending_sources(self) -> List[str]:
        """获取热搜数据源列表"""
        result = self._get("/podcasts/trending/sources/")
        return [s["name"] for s in result.get("routes", [])]

    def get_trending(self, source: str) -> Dict:
        """
        获取热搜数据

        常用 source: bilibili, zhihu, weibo, github, v2ex, douyin, 36kr, juejin, sspai
        """
        return self._get(f"/podcasts/trending/{source}/")

    # ========== 搜索 ==========

    def search(self, query: str) -> Dict:
        """搜索"""
        return self._get("/search/", params={"q": query})

    def search_suggestions(self, query: str) -> List[Dict]:
        """搜索建议"""
        result = self._get("/search/suggestions/", params={"q": query})
        return result.get("results", [])

    def popular_searches(self) -> List[Dict]:
        """热门搜索"""
        result = self._get("/search/popular/")
        return result.get("results", [])

    # ========== 互动 ==========

    def list_comments(self, episode_id: int) -> List[Dict]:
        """获取评论列表"""
        result = self._get(f"/interactions/episodes/{episode_id}/comments/")
        return result.get("results", [])

    def create_comment(self, episode_id: int, text: str) -> Dict:
        """发表评论"""
        return self._post("/interactions/comments/create/", {
            "episode": episode_id,
            "text": text
        }, auth=True)

    # ========== 创作者 ==========

    def my_shows(self) -> List[Dict]:
        """获取我的节目"""
        result = self._get("/podcasts/creator/shows/", auth=True)
        return result if isinstance(result, list) else result.get("results", [])

    def generation_queue(self) -> Dict:
        """获取生成队列"""
        return self._get("/podcasts/creator/generation-queue/", auth=True)


# ========== CLI 接口 ==========

def main():
    import argparse
    import json

    parser = argparse.ArgumentParser(description="MoFA FM API Client")
    parser.add_argument("action", choices=[
        "health", "login", "me", "shows", "episodes", "trending-sources",
        "trending", "search", "search-suggestions", "popular-searches",
        "comments", "create-comment", "my-shows", "generation-queue"
    ])
    parser.add_argument("--username", "-u")
    parser.add_argument("--password", "-p")
    parser.add_argument("--token", "-t", help="JWT access token")
    parser.add_argument("--source", "-s", help="热搜数据源")
    parser.add_argument("--query", "-q", help="搜索关键词")
    parser.add_argument("--episode-id", "-e", type=int, help="单集 ID")
    parser.add_argument("--text", help="评论内容")
    parser.add_argument("--show-slug", help="节目 slug")

    args = parser.parse_args()

    client = MoFAFMClient(access_token=args.token)

    try:
        if args.action == "health":
            result = client._get("/health/")
        elif args.action == "login":
            result = client.login(args.username, args.password)
        elif args.action == "me":
            result = client.me()
        elif args.action == "shows":
            result = client.list_shows()
        elif args.action == "episodes":
            if args.show_slug:
                result = client._get(f"/podcasts/shows/{args.show_slug}/episodes/")
            else:
                result = client.list_episodes()
        elif args.action == "trending-sources":
            sources = client.list_trending_sources()
            result = {"sources": sources, "count": len(sources)}
        elif args.action == "trending":
            result = client.get_trending(args.source)
        elif args.action == "search":
            result = client.search(args.query)
        elif args.action == "search-suggestions":
            result = client.search_suggestions(args.query)
        elif args.action == "popular-searches":
            result = client.popular_searches()
        elif args.action == "comments":
            result = client.list_comments(args.episode_id)
        elif args.action == "create-comment":
            result = client.create_comment(args.episode_id, args.text)
        elif args.action == "my-shows":
            result = client.my_shows()
        elif args.action == "generation-queue":
            result = client.generation_queue()
        else:
            result = {"error": "Unknown action"}

        print(json.dumps(result, indent=2, ensure_ascii=False))

    except requests.HTTPError as e:
        print(json.dumps({
            "error": "HTTP Error",
            "status_code": e.response.status_code,
            "message": e.response.text
        }, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}, indent=2))


if __name__ == "__main__":
    main()
