# Bộ truyện s8 — 星之泪失窃案 (Vụ trộm Giọt Lệ Sao)

Truyện furry **trinh thám**, cùng thế giới với s6 (失物招领处的狐狸) và s7 (寻找月亮湖), **sáng tác mới hoàn toàn** (không phỏng theo vụ án/nhân vật trinh thám có sẵn). Trong sáng, mọi lứa tuổi: không có án mạng, không bạo lực. **HSK 4**, 12 chương.

Quy cách chung: theo `BRIEF.md` + mục 2 của `BRIEF_MORE.md` (kind "series"). Mỗi chương:
- `id` "s8-01" … "s8-12", `kind` "series", `level` 4, `series` "s8", `series_title` "星之泪失窃案", `series_title_vi` "Vụ trộm Giọt Lệ Sao", `chapter` 1..12, `title`, `title_vi`, `topic` "truyện dài".
- 750–900 chữ Hán (nháp đầu nhắm ~850, đừng vượt), 7–8 đoạn; `translations` dịch từng đoạn, tiếng Việt tự nhiên.
- 3 câu hỏi `{q, q_vi, options[4], answer (0–3), explain_vi}`, đáp án phân bố đều; nên có câu hỏi kiểu suy luận ("根据……可以推断……").
- Từ vựng chủ yếu trong `vocab_hsk1..4.txt`; hạn chế từ ngoài cấp (tên loài vật được phép). Lời thoại trong “…”; mỗi đoạn có lời thoại chỉ một người nói chính.
- **Kể ở ngôi thứ ba**, bám theo 鹿鸣 (người đọc khám phá cùng cô).
- **Trinh thám chơi đẹp**: manh mối phải xuất hiện TRƯỚC khi được giải thích (xem bảng manh mối). Không tiết lộ hung thủ trước chương 9–11. Đặc điểm loài vật là chìa khóa suy luận.
- Cuối mỗi chương (trừ 12) có nút thắt.

## Bối cảnh
- **绿林城**. **绿林博物馆**: bảo tàng 70 năm tuổi, cũ, ít khách; sảnh trần rất cao (khoảng 6 mét) có đèn chùm pha lê lớn; giữa sảnh là **mô hình cây cổ thụ** cao chạm trần (古树模型), trên ngọn có tổ chim mẫu.
- **星之泪** (Giọt Lệ Sao): viên đá quý xanh lam to bằng quả trứng chim, báu vật của bảo tàng, đặt trong tủ kính có khóa (chìa: giám đốc và bảo vệ giữ).
- **夜白侦探社**: văn phòng thám tử nhỏ trên tầng hai **quán mì của 熊婶** (thím Gấu, s6) — cùng tòa nhà với gác mái của A Chanh và phòng của 豆豆 (thỏ). Cameo nhỏ được phép (豆豆 mang tin đồn, 熊婶 mang mì), A Chanh có thể chào một câu.
- **獾师傅** (bác thợ Lửng, s6) mở tiệm đồng hồ: cũng bán bộ hẹn giờ.

## Nhân vật (Hán Việt trong bản dịch)
- **鹿鸣** (Lộc Minh): hươu cái 19 tuổi, phóng viên thực tập của báo 《绿林日报》, muốn viết được một tin lớn; hay hồi hộp (tai cụp), ghi chép mọi thứ vào sổ nhỏ, có trí nhớ tốt về hình ảnh.
- **夜白** (Dạ Bạch): mèo đen, thám tử. Lười, thích nằm phơi nắng, mê cá khô, nói ít mà châm chọc; quan sát cực tinh (râu cảm nhận gió, mắt nhìn tốt trong tối). Câu cửa miệng: **“眼睛会骗人，细节不会。”** (Mắt có thể lừa người, chi tiết thì không.)
- **白霜** (Bạch Sương): sói xám, cảnh sát (s6), nay ở đội điều tra. Nghiêm túc, hay cãi với 夜白 nhưng tin anh. (Chuyện của cô ở s6 có thể nhắc thoáng.)
- **高远** (Cao Viễn): hươu cao cổ (长颈鹿), giám đốc bảo tàng. Hiền, lịch sự, luôn quàng một **chiếc khăn len dài màu đỏ**, thích ăn lá keo (金合欢叶). Yêu bảo tàng như nhà. **(Hung thủ — chỉ lộ ở chương 9–11.)**
- **夜灵** (Dạ Linh): dơi, bảo vệ ca đêm; trong bóng tối "nhìn" bằng tiếng vọng (听声音辨方向).
- **土豆** (Thổ Đậu): chuột chũi, thợ điện của bảo tàng; quen đường hầm dưới đất; nhút nhát.
- **艳艳** (Diễm Diễm): công (孔雀), nhà thiết kế trang sức nổi tiếng, kiêu kỳ, đuôi dài lộng lẫy, từng muốn mua 星之泪.
- **灰灰** (Hôi Hôi): gấu mèo (浣熊), từng ăn trộm hồi trẻ, nay làm ở trạm thu gom phế liệu, sống lương thiện; vì "mặt nạ" đen quanh mắt nên ai cũng nghi.
- 《绿林日报》 tổng biên tập: **牛主编** (trâu, tổng biên tập Ngưu).

## Sự thật vụ án (để mọi người viết nhất quán — chỉ tiết lộ dần)
- Bảo tàng nợ nhiều, tháng sau phải đóng cửa. 高远 nghĩ ra kế: tự "trộm" 星之泪, giấu đi, rồi trước báo chí "tìm lại" được — vụ việc ồn ào sẽ kéo khách tới cứu bảo tàng. Ông không định hại ai, nhưng khi 灰灰 bị bắt nhầm, ông sợ nên im lặng → áy náy.
- Tối tiệc khai mạc triển lãm (9 giờ tối), ông dùng **bộ hẹn giờ mua ở tiệm 獾师傅** gắn vào hộp cầu dao → **mất điện đúng 10 phút**. Trong bóng tối, ông dùng chìa của mình mở tủ kính, rồi **vươn cổ đặt viên đá vào tổ chim trên ngọn mô hình cây cổ thụ** (cao hơn 5 mét, chỉ hươu cao cổ với tới). Cổ ông chạm vào đèn chùm làm nó đung đưa; khăn đỏ dính đầy bụi xám trên ngọn cây.
- Sau đó (đêm trước họp báo) ông lấy viên đá xuống, chuẩn bị "tìm thấy" nó ở họp báo.

## Bảng manh mối (chương nào cài)
| Manh mối | Cài ở chương | Giải thích ở |
|---|---|---|
| Đèn chùm còn khẽ đung đưa khi đèn sáng lại; trên sàn ngay dưới có ít bụi rơi | 2 | 9 |
| Tủ kính không vỡ, mở bằng chìa | 2 | 9 |
| 夜灵 trong bóng tối "nghe" thấy một tiếng sột soạt rất cao, gần trần nhà, và bước chân chậm, nhẹ, rất dài | 4 | 9 |
| Cầu dao bị gắn bộ hẹn giờ (土豆 phát hiện) | 4 | 7 |
| Thư nợ nhàu trong thùng rác: “如果下个月还不上钱，博物馆就要关门了” | 4 | 10 |
| Bụi trên bục trưng bày không có vết kéo đuôi dài → 艳艳 vô can | 5 | 5 |
| Một chiếc lá keo tươi trên sàn cạnh mô hình cây; vết bụi bị quệt ở độ cao ~5 mét trên cành giả | 6 | 9 |
| 獾师傅 nhớ người mua bộ hẹn giờ: rất cao, đội mũ, quàng khăn kín, phải cúi thấp mới qua cửa | 7 | 9 |
| Ảnh tiệc: khăn của 高远 lúc 8:55 đỏ tươi, lúc 9:15 lấm bụi xám | 8 | 9 |

## Dàn ý 12 chương
1. **楼上的侦探** — 鹿鸣 bị 牛主编 giao bài nhàm: phỏng vấn "thám tử kỳ quặc" trên quán mì 熊婶. 夜白 vừa gặp đã đoán đúng nhiều điều về cô (cô vừa chạy tới vì trễ xe, mới chuyển nhà, sợ chó…) từ chi tiết nhỏ — hài hước. Cameo 豆豆/熊婶. *Nút thắt*: điện thoại reo — 白霜: “星之泪昨天晚上被偷了。你来不来？” 鹿鸣 nằng nặc đi theo.
2. **博物馆的十分钟** — Bảo tàng, 高远 lo lắng tiếp đón (khăn đỏ dài). Kể lại tối qua: tiệc khai mạc, khách VIP, 9 giờ mất điện 10 phút, đèn sáng lại thì tủ kính trống, không vỡ. 夜白 nằm ngửa trên sàn nhìn trần (mọi người tưởng anh lười) — nhắc đến đèn chùm đung đưa và bụi. *Nút thắt*: 白霜 báo: cảnh sát đã bắt được nghi phạm — gấu mèo 灰灰, bị thấy ở hẻm sau bảo tàng, túi có găng tay đen.
3. **戴面具的浣熊** — Đồn cảnh sát. Mọi người nghi 灰灰 vì quá khứ và "mặt nạ"; 灰灰 nói chỉ đến xem triển lãm, không chịu nói thêm. 夜白 ngửi găng tay: mùi xà phòng và giấy cũ, không có mùi kim loại hay mùi tủ kính; móng 灰灰 sạch. *Nút thắt*: 夜白: “小偷不是他。真正的小偷，还在博物馆里。”
4. **嫌疑人名单** — Danh sách: 夜灵, 土豆, 艳艳, 高远. Phỏng vấn: 夜灵 kể trong tối nghe tiếng sột soạt rất cao gần trần và bước chân chậm, dài; 土豆 phát hiện cầu dao có gắn bộ hẹn giờ — không phải sự cố. 高远 nói lúc mất điện ông "ở trong văn phòng". *Nút thắt*: 鹿鸣 nhặt trong thùng rác một lá thư nhàu: “如果下个月还不上钱，博物馆就要关门了。”
5. **孔雀的秘密** — 艳艳 từng muốn mua đá, tối đó còn cãi nhau với giám đốc → 鹿鸣 nghi mạnh. 夜白 chỉ ra: đuôi dài của công kéo qua đâu cũng quét bụi, nhưng bụi quanh bục trưng bày nguyên vẹn → không phải cô. Hóa ra cô cãi vì muốn **tặng tiền** cho bảo tàng mà giám đốc từ chối vì tự ái. (Thư nợ: nghi ngờ chuyển sang chuyện tiền.) *Nút thắt*: tối về, dưới cửa văn phòng có mảnh giấy: “别再查了。”
6. **深夜的博物馆** — 夜白, 鹿鸣, 白霜 lén vào bảo tàng ban đêm để dựng lại 10 phút tối; 夜灵 giúp. Mắt mèo nhìn trong tối: một chiếc lá keo tươi cạnh mô hình cây; trên cành giả ở độ cao khoảng 5 mét có vết bụi bị quệt. 鹿鸣 ghi chép mà chưa hiểu. *Nút thắt*: trong bóng tối có tiếng bước chân khác, đèn pin quét qua một cái bóng nhỏ đang chạy về phía tầng hầm.
7. **地下的通道** — Đuổi theo: cái bóng là 土豆 dùng đường hầm; cậu sợ bị nghi nên tự đi điều tra. Cậu đưa ra bộ hẹn giờ tháo từ cầu dao, có nhãn tiệm 獾师傅. Đến tiệm: 獾师傅 cộc cằn nhưng nhớ: người mua rất cao, đội mũ, quàng khăn kín mặt, phải cúi thấp mới qua cửa. *Nút thắt*: 白霜 nhận lệnh cấp trên: ngày mai sẽ chính thức buộc tội 灰灰 để đóng vụ án.
8. **浣熊的过去** — 鹿鸣 một mình đến trạm phế liệu gặp 灰灰. Anh kể: hồi nhỏ từng lấy trộm một chiếc huy hiệu nhỏ ở bảo tàng; ông giám đốc cũ tha thứ và cho anh vé xem miễn phí — đó là lần đầu có người tin anh. Tối đó anh đến để lén trả lại huy hiệu, sợ không ai tin nên không dám nói. 鹿鸣 xúc động, hứa sẽ chứng minh anh vô tội. Về nhà xem lại ảnh tiệc chụp trên máy. *Nút thắt*: cô phát hiện chiếc khăn đỏ của 高远 lúc 8:55 còn đỏ tươi, lúc 9:15 lại lấm bụi xám.
9. **长脖子的影子** — 鹿鸣 mang ảnh tới; 夜白 xếp các manh mối: đèn chùm đung đưa (thứ gì đó rất cao chạm vào), tiếng sột soạt gần trần và bước chân dài chậm (夜灵), vết bụi ở độ cao 5 mét và lá keo, người mua hẹn giờ rất cao, khăn dính bụi, tủ mở bằng chìa. Chỉ một người hợp: 高远. 鹿鸣 sốc vì ông hiền lành. 夜白: “可是我们还缺最重要的一样东西——星之泪在哪儿。” *Nút thắt*: tin tức: 高远 tuyên bố sáng mai họp báo: “星之泪就要找回来了。”
10. **记者会前夜** — Đêm trước họp báo, 夜白 nói lý thuyết cho 白霜; động cơ là lá thư nợ. Phải tìm ra viên đá trước. 鹿鸣 gợi ý "hãy nghĩ như một con hươu cao cổ": chỗ cao nhất — tổ chim trên ngọn cây cổ thụ. 白霜 và 夜白 leo lên (mèo leo giỏi). *Nút thắt*: trong tổ chim chỉ còn một vết lõm hình quả trứng trong lớp bụi — viên đá đã bị lấy đi.
11. **真相** — Họp báo: 高远 "tìm thấy" viên đá trong một hộp cũ ở kho. 夜白 bước lên, bình tĩnh trình bày từng manh mối; vết lõm trong tổ chim khớp kích thước viên đá; bụi xám trên khăn giống bụi trên ngọn cây. 高远 im lặng lâu, rồi thừa nhận: ông chỉ muốn cứu bảo tàng 70 năm, không định hại ai, nhưng khi 灰灰 bị bắt ông đã im lặng — "đó là việc tôi xấu hổ nhất đời". Cảm động, tiết chế. *Nút thắt nhỏ*: 白霜 dẫn ông đi; ông dặn 鹿鸣: “请你……把博物馆的故事写下来。”
12. **星星的眼泪** — (kết trọn vẹn) 灰灰 được thả, mọi người xin lỗi; 灰灰 trả lại chiếc huy hiệu. Bài báo của 鹿鸣 《被误会的面具》 và câu chuyện bảo tàng khiến cả thành phố quyên góp; 艳艳 cũng tặng tiền; bảo tàng không phải đóng cửa. 高远 nhận hình phạt nhẹ và nghỉ việc, nhưng thường đến làm tình nguyện viên; 灰灰 thành hướng dẫn viên bảo tàng. 白霜 và 夜白 vẫn cãi nhau nhưng tôn trọng nhau. 鹿鸣 được 牛主编 khen, làm cộng sự bán thời gian của 夜白. Cảnh cuối: có người gõ cửa văn phòng — một vị khách mới; 夜白 duỗi người, nói: “眼睛会骗人，细节不会。进来吧。”
