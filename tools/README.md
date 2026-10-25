# 調整用ボット

描画と切り離したコア（`UNITS` 〜 `prestige()`）を HTML から抜き出し、Node でボットに遊ばせて各素材への到達時間を測る。

```sh
cd tools
node extract-core.js ../index.html   # core.js を生成
node bot.js            # 放置のみ / タップあり の両方（最大180分）
node bot.js idle 60    # 放置のみ、最大60分
node bot.js tap 60     # 0.17秒ごとにタップ（幸運ブロックが出たら優先）
node bot.js tap 240 2  # エンディング後に砕いて永続強化を買い、2周目も測る
node bot.js ctap 100    # ふつうの人（10秒ごとにランダムに買う・0.33秒ごとにタップ）。cidle は放置のみ
ENDLESS=1 node bot.js ctap 240   # エンディング後も「宇宙の先」へ進み続けて測る
```

出力の `reach` は各素材に到達した分、`endMin` は宇宙の核を倒した分。`dustAtUnlock` は砕けるようになった時点の星屑、`dustAtEnd` はエンディング時点の星屑。
`relics` は集めた遺物（種類/個数）、`deepest` は一番深く届いた素材、`evo` は進化した兵器。
ボットは2秒ごとに「買える中でいちばん安いもの」を買い続ける。

## プレイデータを読む

ゲームの「ヘルプ → プレイデータをコピー」で出る `RENSA1:...` の文字列を渡すと、素材・強化Lv・モジュール・遺物・永続強化・買える特殊強化（小さな強化を含む）などをまとめて出す。

```sh
node save-report.js "RENSA1:...."   # またはファイルに保存して node save-report.js save.txt
```
