# 調整用ボット

描画と切り離したコア（`UNITS` 〜 `step()`）を HTML から抜き出し、Node でボットに遊ばせて各素材への到達時間を測る。

```sh
cd tools
node extract-core.js ../index.html   # core.js を生成
node bot.js            # 放置のみ / タップあり の両方（最大120分）
node bot.js idle 60    # 放置のみ、最大60分
node bot.js tap 60     # 0.17秒ごとにタップ
```

出力の `reach` は各素材に到達した分、`endMin` は銀河のボスを倒した分。
ボットは2秒ごとに「買える中でいちばん安いもの」を買い続ける。
