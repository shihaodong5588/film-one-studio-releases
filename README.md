# Film-one Studio · 试用下载

这里仅存放 Film-one Studio 的安装包、版本清单和发布自动化。应用开发仓库未上传；安装包包含运行所需的程序与资源。

官网：https://film-one-studio.guangxinshi06.chatgpt.site/

当前试用版面向 Apple 芯片 Mac，采用本地 ad-hoc 签名，尚无 Apple Developer ID 签名或公证。macOS 可能提示无法验证开发者或阻止打开。安装包 SHA-256 用于核对下载完整性，不代表 Apple 安全认证。

从官网或本仓库 Releases 下载 DMG，将应用复制至“应用程序”。更新前退出旧版，再用新版替换应用；请保留本机项目与设置。遇到安全提示，请先核对来源与校验值，并参考 [Apple 官方说明](https://support.apple.com/en-us/102445)自行判断；不要关闭系统安全保护。

应用本身不收试用安装费。图片、视频、声音和助手推理使用你配置的服务商账号额度。

发布流程通过标准免费 macOS runner 封装安装包，先验证上传与公开下载的字节，再更新 `releases.json`。没有把 GitHub 凭据、用户数据库、媒体或模型 API 密钥放进安装包。
