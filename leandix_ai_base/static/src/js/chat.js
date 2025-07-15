/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { formView } from '@web/views/form/form_view';
import { FormController }
    from "@web/views/form/form_controller";
import { Component } from "@odoo/owl";
import { session } from "@web/session";
import { useState } from "@odoo/owl";

export class ChatController extends FormController {    
    //run setup interface
    async setup() {
        super.setup();
        this.rawData = ""; // this variable will hold the data structure, which mean it contains how the data will look like when User Interface revice it, not the real rawData
        this.user_confirm = true;
        this.state = useState({ sending: false }); // this variable will disable button if true
        this.server_api = null; //variable for server api
        this.setServerApi();
        this.autoExpand = this.autoExpand.bind(this); // Bind hàm để tránh undefined
        this.value = null; //variable for holding current chat data
        this.sql_query = null;
        this.USER_ID = this.env.searchModel._context.uid; // this is user_id
        this.thinking = false; // variable for thinking effect
        this.showDeletePanel = false; //variable for delete panel toggle
        this.SAD = true; //variable for search and delete toggle
        this.chat_model = "GPT"; //variable for model selection
        this.orm = useService("orm");
        this.data_his = [];
        this.wait = true;
        this.DEMO = true;
        this.user_lang = await this.getUserLang();
        await this.updateHeight();
        this.conversation_list = await this.getConversationList().then((result) => {
            this.value = result;
            return result; // Trả về kết quả để giữ giá trị
        });
        this.delete_selection = [];

        setTimeout(() => {
            this.getHistory();
        }, 500);
        const newmess = await this.orm.call(
            "leandix.ai.base.session", 
            "set_new_conversation",   
            [] 
        );
        // this current conversation id
        this.is_new_conversation = true;
        this.toggle = true;
        this.current_convesation_id = null;
        this.show_setting_panel_toggle(); //calling the SAD funtion ( SAD = search and delete )
        

        // Khởi tạo các biến trạng thái cần thiết cho việc parse streaming Markdown
        this.markdownBuffer = ""; // Chứa toàn bộ văn bản thô (chưa thoát HTML) nhận được
        this.currentHtmlOutput = ""; // Chứa toàn bộ HTML đã được parse và sẵn sàng hiển thị
        this.pendingBold = false; // Theo dõi xem có thẻ bold nào đang mở nhưng chưa đóng không
        this.new_table = true;
        this.saving = ""
    }                

    // Hàm gọi tool cập nhật
    async update_record(model_name, record_id, field_values){
        const data = await this.orm.call(
            "leandix.tools",               // model trong Python
            "update_record",               // method trong Python
            [model_name, record_id, field_values]
        );
    }

    ////////////////////////////////
    //                            //
    //        Working Flow        //
    //                            //
    ////////////////////////////////

    async sendMessage() {
        if (this.state.sending) return;
        this.state.sending = true;

        try {
            this.autoExpandonclick();
            this.hide_something();
            const inputElement = document.querySelector(".chat_text");
            let userMessage = inputElement.value.trim();

            if (!userMessage) return;

            this.thinking = true;
            this.animateDots();
            inputElement.value = "";

            const chatContainer = document.querySelector(".chat_container_body");

            const userMessageDiv = document.createElement("div");
            userMessageDiv.classList.add("user-message");
            userMessageDiv.innerHTML = `
                <div class="user-message-content">
                    <p>${userMessage}</p>
                </div>
            `;
            chatContainer.appendChild(userMessageDiv);
            this.scrollToBottom();

            const params = new URLSearchParams({
                message: userMessage,
                chat_model: this.chat_model
            });

            const response = await fetch(`/leandix_ai_base/get_direct_answer?${params.toString()}`, {
                method: 'GET',
                cache: 'no-store',
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            const sessionConvId = await this.orm.call(
                "leandix.ai.base.session",
                "get_session_conversation",
                []
            );
            this.current_convesation_id = sessionConvId;

            const botMessageDiv = document.createElement("div");
            botMessageDiv.classList.add("bot-message");
            const botContent = document.createElement("div");
            botContent.classList.add("bot-message-content");
            botMessageDiv.appendChild(botContent);

            //Error API Key
            chatContainer.appendChild(botMessageDiv);
            this.scrollToBottom();

            let currentP = document.createElement("p");
            botContent.appendChild(currentP);
            let justRenderedTable = false;
            let NS = false
            const read = async () => {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    let chunk = decoder.decode(value, { stream: true });
                    if (chunk.includes("[E]")) {
                        chunk = chunk.replace("[E]", "");
                        break;  // Dừng stream
                    }
                    if (chunk.includes("[NS]")) {
                        chunk = chunk.replace("[NS]", "");
                        NS = true
                    }

                    let lines = chunk.split('\n');
                    for (let line of lines) {
                        let processedLine = line

                        // ❌ Bỏ qua [SAVE_CHAT_ID] 
                        if (processedLine.includes('[SAVE_CHAT_ID]')) {
                            continue;
                        }

                        // ✅ Dòng bảng
                        if (processedLine.trimStart().startsWith('|')) {
                            this._processTableInitialization(processedLine, botContent);
                            justRenderedTable = true;
                            continue;
                        }

                        // ✅ Sau bảng thì tạo <p> mới
                        if (justRenderedTable) {
                            currentP = document.createElement("p");
                            botContent.appendChild(currentP);
                            justRenderedTable = false;
                        }

                        // ✅ Text bình thường
                        if (
                            processedLine.trim() === '' &&
                            currentP.innerHTML.length > 0 &&
                            !currentP.innerHTML.endsWith('<br>')
                        ) {
                            currentP.innerHTML += '<br>';
                        } else {
                            this.saving = ""
                            if(NS == true){
                                currentP.innerHTML += processedLine
                                this.saving += botContent.innerHTML
                            }else{
                                const cleanedHtml = this._cleanInconsistentWhitespaces(processedLine);
                                const parsedHtml = this._parseStreamingMarkdown(cleanedHtml, false);
                                currentP.innerHTML += parsedHtml;
                                this.saving += botContent.innerHTML
                            }
                        }
                    }

                    this.scrollToBottom();
                }

                this.thinking = false;
                this.animateDots();
            };
            await read();
            const ConvId = this.current_convesation_id;
            const chat_id = (ConvId && typeof ConvId === 'object') ? ConvId.value : ConvId;
            const result = await this.orm.call(
                "leandix.ai.base.chat.history",
                "add_message",
                [chat_id, "system", this.saving]
            );
        } catch (error) {
            console.error("❌ Lỗi khi gửi/nhận tin nhắn:", error);
            this.thinking = false;
            this.new_table = true;
            this.animateDots();
        } finally {
            this.getHistory();
            this.new_table = true;
            this.state.sending = false;
        }
    }

_processTableInitialization(chunk, containerElement) {
    const trimmedLine = chunk.trimStart();

    // Bỏ qua nếu không phải dòng bảng
    if (!trimmedLine.startsWith('|')) {
        this.new_table = true;
        this.currentTable = null;
        return;
    }

    // Bỏ qua dòng ngăn cách Markdown có nhiều hơn 5 dấu gạch ngang liên tục (---)
    if (/[-]{5,}/.test(trimmedLine)) {
        return;
    }
    // Nếu bắt đầu bảng mới
    if (this.new_table) {
        const table = document.createElement("table");
        table.classList.add("streaming-markdown-table");
        this.currentTable = table;
        containerElement.appendChild(table);
        this.new_table = false;
    }

    // Thêm hàng vào bảng hiện tại
    if (this.currentTable) {
        const row = document.createElement("tr");
        const rawCells = trimmedLine.split('|').slice(1, -1); // bỏ | đầu & cuối
        const isHeader = this.currentTable.querySelectorAll("tr").length === 0;

        for (const cellText of rawCells) {
            const cell = isHeader ? document.createElement("th") : document.createElement("td");
            const cleanedText = this._cleanInconsistentWhitespaces(cellText.trim()); // ✅ Làm sạch văn bản
            cell.textContent = cleanedText;
            row.appendChild(cell);
        }

        this.currentTable.appendChild(row);
    }
}
    /**
     * Parses the accumulated markdownBuffer incrementally, handling bold formatting and <br>.
     * This function is designed to handle incomplete markdown tags across chunks.
     * It updates this.markdownBuffer (by setting it to the unparsed remainder)
     * and returns the total accumulated HTML.
     * @param {string} buffer The current accumulated markdown text (this.markdownBuffer).
     * @param {boolean} isEnd True if the stream has finished.
     * @returns {string} The complete HTML string parsed so far.
     */
    _parseStreamingMarkdown(buffer, isEnd) {
        let htmlSegments = [];
        let remainingBuffer = buffer;

        let lines = remainingBuffer.split('<br>');
        let inList = false;

        const closeListIfNeeded = () => {
            if (inList) {
                htmlSegments.push('</ul>');
                inList = false;
            }
        };

        const escapeExceptTags = (text) => {
            return text
                .replace(/&(?!(?:[a-z]+|#\d+);)/gi, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
        };

        for (let rawLine of lines) {
            let line = rawLine.trim();

            if (!line) {
                closeListIfNeeded();
                if (htmlSegments.length > 0 && htmlSegments[htmlSegments.length - 1] !== '<br>') {
                    htmlSegments.push('<br>');
                }
                continue;
            }

            if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
                closeListIfNeeded();
                htmlSegments.push('<hr>');
                continue;
            }
            // Headings
            if (/^#{1,6}\s/.test(line)) {
                closeListIfNeeded();
                const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
                const level = headingMatch[1].length;
                const content = escapeExceptTags(headingMatch[2]);
                htmlSegments.push(`<h${level}>${content}</h${level}>`);
                continue;
            }

            // Bullet lists: - or * or +
            if (/^[-*+]\s+/.test(line)) {
                if (!inList) {
                    htmlSegments.push('<ul>');
                    inList = true;
                }
                const item = line.replace(/^[-*+]\s+/, '');
                const parsedItem = this._renderInlineMarkdown(item);
                htmlSegments.push(`<li>${parsedItem}</li>`);
                continue;
            } else {
                closeListIfNeeded();
            }

            // Paragraph or plain text
            const parsedLine = this._renderInlineMarkdown(line);
            htmlSegments.push(`<p>${parsedLine}</p>`);
        }

        closeListIfNeeded();
        this.markdownBuffer = '';
        return this.currentHtmlOutput + htmlSegments.join('');
    }

    _renderInlineMarkdown(text) {
        // Xử lý inline Markdown: **bold**, _italic_, `code`
        let result = text;

        // Bold: **text**
        result = result.replace(/\*\*(.+?)\*\*/g, (_, m) => `<strong>${this._escapeHtml(m)}</strong>`);

        // Italic: _text_ or *text*
        result = result.replace(/(?:\*|_)(.+?)(?:\*|_)/g, (_, m) => `<em>${this._escapeHtml(m)}</em>`);

        // Inline code: `code`
        result = result.replace(/`(.+?)`/g, (_, m) => `<code>${this._escapeHtml(m)}</code>`);

        // Escape remaining HTML
        return result;
    }

    _escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

_cleanInconsistentWhitespaces(html) {
    const textCleaner = (text) => {
        return text
            .replace(/(\p{L})\s(?=\p{L})/gu, '$1')      // remove space between letters
            .replace(/\s*@\s*/g, '@')                   // remove space around @
            .replace(/\s*\.\s*/g, '.')                  // remove space around .
            .replace(/\s{2,}/g, ' ')                    // collapse multiple spaces
            .replace(/\s+([.,:!?])/g, '$1')             // remove space before punctuation
            .trim();
    };

    // Regex tách các phần HTML tag và non-tag
    return html.replace(/(<[^>]*>)|([^<]+)/g, (match, tag, text) => {
        if (tag) return tag; // Giữ nguyên tag
        if (text) return textCleaner(text); // Làm sạch text
        return match;
    });
}





    async check_api_type() {
        const response = await this.orm.call(
            "leandix.ai.base.chat.model",
            "check_api_type",
            [], 
        );

        return response;
    }

    // This function will call Answer Pretier function in Odoo Backend
    async formatingData(sql_query,sql_result,rawData){
        const data = await this.orm.call(
            "leandix.ai.base.chat.model", // model
            "answer_pretier",          // method
            [sql_query,sql_result,rawData] // args
        );
        return data.bot_reply;
    };
    // This function will send user DATA to Engine to analytics in Odoo Backend
    async sendMessageToAnswerAPI(message, sql_query, sql_result, chat_model, uid, history) {
        const data = await this.orm.call(
            "leandix.ai.base.chat.model",
            "send_message_to_answer_api",
            [message, sql_query, sql_result, chat_model, uid, history]
        );
        return data.answer
    }
    



    ////////////////////////////////
    //                            //
    //    Conversation managing   //
    //                            //
    ////////////////////////////////
    // hàm này để lấy ngôn ngữ của người dùng
    getUserLang() {
        return this.orm
            .call("leandix.ai.base.chat.model", "get_current_user_lang", [])
            .then(result => {
                // result có dạng {lang: "vi_VN"} hoặc {error: "..."}
                if (result && result.lang) {
                    return result.lang.toLowerCase();
                }
                // Mặc định nếu lỗi hoặc không có lang
                return "en_us";
            })
            .catch(() => "en_us");
    }

    // Hàm này để gọi switch toggle
    onToggleFeature(event) {
        const isChecked = event.target.checked;
        if (isChecked) {
            this.user_confirm = true
        } else {
            this.user_confirm = false
        }
    }
    
    async setServerApi() {
        const result = await this.orm.call("leandix.ai.base.chat.history", "get_values", []);
        return this.server_api = result.value
    }
    //this function is for getting conversation list name
    getConversationList() {
        return this.orm
            .call("leandix.ai.base.chat.history", "get_history_by_uid", [this.env.searchModel._context.uid])
            // Extracts and returns result.result

    }
    //this function will call the delete function from backend to delete message in DB
    deleteConversations(chatIds) {
        return this.orm
            .call("leandix.ai.base.chat.history", "delete_conversations", [this.env.searchModel._context.uid,chatIds])
            .then(result => {
                if (result.success) {
                    this.data_his = [];
                } else {
                    console.error("Xóa thất bại:", result.message);
                }
                return result;
            })
            .catch(error => {
                console.error("Lỗi khi gọi API xóa:", error);
            });
    }
    //thinking ... effect
    animateDots() {
        const dots = document.querySelectorAll(".thinking span");
        const thinkingDiv = document.querySelector(".thinking");
        if(this.thinking){
            thinkingDiv.style.display = "flex";
            dots.forEach((dot, index) => {
                setTimeout(() => {
                    dot.style.opacity = "1";
                    setTimeout(() => {
                        dot.style.opacity = "0.3";
                    }, 300);
                }, index * 400);
            });
    
            setTimeout(() => this.animateDots(), dots.length * 400 + 500);
        }else{
            thinkingDiv.style.display = "none";
        }
    }
    // show and hide effect for search and delete
    show_setting_panel_toggle(){
        //hide delete panel if currently visible
        if(this.showDeletePanel){
            this.delete_function_effect();
        }


        let panel = document.getElementById("setting_pannel");
        let btn = document.getElementById("search_btn");
        if(panel){
            if(this.SAD){
                panel.style.marginTop = `0px`;
                this.SAD = false;
                btn.classList.add("btn_search_active")
            }else{
                panel.style.marginTop = `-55px`;
                this.SAD = true;
                btn.classList.remove("btn_search_active")
            }   
        }

    }
    //search function
    search_function() {
        let search_value = document.querySelector(".my_search_input").value;
        let elements = document.querySelectorAll(".conversation_list_header_items"); // Lấy danh sách các phần tử cần lọc
    
        elements.forEach(el => {
            let itemName = el.textContent.trim().toLowerCase(); // Lấy nội dung text của từng phần tử
    
            if (itemName.includes(search_value)) {
                el.style.display = ""; // Hiển thị nếu tìm thấy
            } else {
                el.style.display = "none"; // Ẩn nếu không khớp
            }
        });
    }
    //delete function effect
    delete_function_effect() {
        // Hide the search bar if it is currently visible
        if(!this.SAD){
            this.show_setting_panel_toggle();
        }

    
        // Get the delete button by ID
        let deleteBtn = document.getElementById("delete_btn");
        let delete_pannel = document.querySelector(".delete_pannel");
        let side_bar = document.getElementById("side_bar");
        let navbar = document.querySelector(".o_main_navbar.d-print-none");
        // Toggle class on click
        if (deleteBtn) {
            deleteBtn.classList.toggle("btn_delete_active");
            if(this.showDeletePanel){
                this.showDeletePanel = false
                delete_pannel.style.display = "none";
                this.updateHeight();
            }else if(delete_pannel){
                this.showDeletePanel = true
                delete_pannel.style.display = "flex";
                let panelHeight = delete_pannel.offsetHeight;
                let navbarHeight = navbar.offsetHeight;
                side_bar.style.height = `calc(100vh - ${panelHeight}px - ${navbarHeight}px)`;
            }
        }
    }
    async delete_comfirm(){
        // chuyển các phần tử trong mảng sang number
        this.delete_selection = this.delete_selection.map(id => Number(id));
        // Gọi hàm deleteConversations và xóa
        await this.deleteConversations(this.delete_selection);
        await this.getHistory();
        this.showDeletePanel = true;
        this.delete_function_effect();
        this.new_conversation();
        this.delete_selection = [];
    }
    delete_cancle(){
        this.showDeletePanel = true;
        this.delete_selection = [];
        let div_content = document.getElementById("conversation_list_header");
        
        if (div_content) {
            // Lấy tất cả các thẻ div con trong div_content
            let divs = div_content.querySelectorAll("div");
            
            // Duyệt qua tất cả các thẻ div và gỡ bỏ lớp "delete_selected"
            divs.forEach((div) => {
                div.classList.remove("delete_selected");
            });
            this.delete_function_effect();
        }
        

    }
    // hiding hint example when the user active some action
    hide_something(){
        let hide_btn = document.querySelector(".quick-action-area");
        if(hide_btn){
            hide_btn.classList.add("hidden");
        }

    }
    updateHeight() {
        let interval = setInterval(() => {
            let navbar = document.querySelector(".o_main_navbar.d-print-none");
            let chat_container = document.querySelector(".chat_container");
            let chat_container_content = document.querySelector("#chat_container_content");
            let side_bar = document.querySelector("#side_bar");
            if (navbar && chat_container && chat_container_content && side_bar) {
                let navbarHeight = navbar.offsetHeight;
                chat_container.style.height = `calc(100vh - ${navbarHeight}px)`;
                chat_container_content.style.height = `calc(100% - ${navbarHeight}px)`;
                side_bar.style.height = `calc(100vh - ${navbarHeight}px)`;
                
                // Dừng tìm kiếm khi đã tìm thấy phần tử
                clearInterval(interval);
            }
        }, 200);
    }
    
    
    async getCurrentValues(){
        this.conversation_list = await this.getConversationList().then((result) => {
            this.value = result;
            return result; // Trả về kết quả để giữ giá trị
        });
    }

    // ***** this one is for history *****
    async getHistory() {
        // Lấy phần tử conversation_list_header
        await this.getCurrentValues();
        const headerElement = document.getElementById("conversation_list_header");
        if (headerElement) {
            // Xóa nội dung cũ nếu cần
            headerElement.innerHTML = "";
            // Duyệt qua danh sách conversation và thêm thẻ div
            this.value.forEach((conversation) => {
                const nameDiv = document.createElement("div");
                nameDiv.textContent = conversation.name; // Gán nội dung là name
                nameDiv.classList.add("conversation_list_header_items");
                nameDiv.setAttribute("delete-id", conversation.id);

                // Thêm sự kiện click cho từng div để load message cũ hoặc chọn để xóa
                nameDiv.addEventListener("click",async () => {
                    const deleteId = nameDiv.getAttribute("delete-id");

                    if (this.showDeletePanel == false) {
                        //xét điều kiện để không hiện tin nhắn khi tin nhắn trước đó chưa được render ( vẫn lưu tin nhắn trước đó )
                        this.wait = false
                        this.is_new_conversation = false;
                        this.current_convesation_id = conversation.id;
                        let vvv = await this.orm.call("leandix.ai.base.session", "save_current_chat_id", [this.current_convesation_id]);
                        this.loadMess();
                        this.hide_something();
                        //Tắt thinking nếu người dùng không chờ response ( tương tác khác )
                        this.thinking = false;
                        this.animateDots();
                    } else {
                        // Kiểm tra xem deleteId đã có trong mảng chưa
                        const index = this.delete_selection.indexOf(deleteId);
                        if (index === -1) {
                            // Nếu chưa có, thêm vào mảng (chọn phần tử)
                            this.delete_selection.push(deleteId);
                            nameDiv.classList.add("delete_selected");
                        } else {
                            // Nếu đã có rồi, xóa khỏi mảng (bỏ chọn phần tử)
                            this.delete_selection.splice(index, 1);
                            nameDiv.classList.remove("delete_selected");
                        }
                    }
                });
                headerElement.appendChild(nameDiv);
            });
        }
    }

    loadMess() {
        // Lấy phần tử chat_container_body
        const chatContainer = document.getElementById("chat_container_body");
        if (chatContainer) {
            // Xóa nội dung cũ nếu cần
            chatContainer.innerHTML = "";
            // Tìm conversation có id bằng với this.current_convesation_id
            const conversation = this.value.find(conv => conv.id === this.current_convesation_id);
            if (conversation) {
                // Lặp qua từng message trong conversation.messages
                conversation.messages.forEach((msg, index) => {
                    const messageDiv = document.createElement("div");
                    messageDiv.innerHTML = msg.message; // Gán nội dung tin nhắn
    
                    // Xét vị trí theo thứ tự tự nhiên (index + 1)
                    if ((index + 1) % 2 === 1) {
                        // Nếu vị trí là số lẻ: gán class user_mess
                        messageDiv.classList.add("user-message");
                    } else {
                        // Nếu vị trí là số chẵn: gán class bot_mess
                        messageDiv.classList.add("bot-message");
                    }
        
                    chatContainer.appendChild(messageDiv);
                    //cuộn xuống tin nhắn mới nhất
                    this.scrollToBottom();
                });
            }
        }
    }
    
    // This function will Call the naming_and_create_conversation function in the Odoo Backend
    async create_conversation(prompt) {
        try {
            const result = await this.orm.call(
                "leandix.ai.base.chat.model", // model
                "naming_and_create_conversation",   // tên hàm backend
                [prompt, this.chat_model, this.USER_ID] // các tham số truyền vào: prompt + chat_model + uid
            );
            return result; // result sẽ chứa { id, name } hoặc { error }
        } catch (error) {
            console.error("Lỗi khi gọi create_conversation ORM:", error);
            return { name: "New Conversation", error: true };
        }
    }
    
    // This function will clear the current message on the screen and turn on the is_new_conversation status :3
    async new_conversation(){
        this.is_new_conversation = true;
        document.getElementById('chat_container_body').innerHTML = "";
        const set_new_convs = await this.orm.call(
                "leandix.ai.base.session", // model
                "set_new_conversation",   // tên hàm backend
                [] )
    }
    
    toggleSidebar() {
        let sidebar = document.getElementById("side_bar");
        let start_sidebar = document.querySelector(".delete_pannel");
        let sidebar2 = document.getElementById("sidebar_header2");
        let delete_btn = document.getElementById("delete_btn");
        sidebar2.classList.toggle("sidebar_show");
        if (sidebar) {
            if (this.toggle) {
                sidebar.classList.add("sidebar_responsive");
                sidebar.style.padding = `5px 15px`;
                sidebar.style.marginLeft = `0`;
                this.toggle = false;
                sidebar.style.width = ``;
                if (start_sidebar && delete_btn) {
                    if (delete_btn.classList.contains("btn_delete_active")) {
                        start_sidebar.style.display = `flex`;
                    }
                }
            } else {
                sidebar.style.width = `0px`;
                sidebar.style.padding = `0px`;
                sidebar.style.marginLeft = `-10px`;
                this.toggle = true;
                if (start_sidebar && delete_btn) {
                    if (delete_btn.classList.contains("btn_delete_active")) {
                        start_sidebar.style.display = `none`;
                    }
                }
                
            }
        }

        
    }
    
    // This function will save message and nameing conversation (the naming function is in create_conversation)
    async new_message(message, role, conversation_id = null) {
        let id = conversation_id
        if (!id) {
            console.error("Không xác định được conversation id.");
            return;
        }
        return this.orm.call("leandix.ai.base.chat.history", "add_message", [
            id,
            role,
            message
        ]);
    }

    //cuộn tới tin nhắn mới nhất
    scrollToBottom() {
        const container = document.getElementById("chat_container_body");
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    //đưa chiều cao của text area quay về ban đầu khi nhấn nút
    autoExpandonclick() {
        let textarea = document.querySelector(".chat_text");
        if (!textarea) return; // Không tìm thấy phần tử
        textarea.style.height = "40px"; // Reset chiều cao
        textarea.style.overflow = "hidden"; // Reset chiều cao
    }
    //điều chỉnh textarea height khi nhập
    autoExpand() {
        let textarea = document.querySelector(".chat_text");
        if (!textarea) return; // Không tìm thấy phần tử
        textarea.style.height = "40px"; // Reset chiều cao
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px"; // Giới hạn tối đa 200px
    }
    
    //Hàm xử lý khi nhấn Enter
    handleKeyDown(event) {
        // ctrl + enter
        if ((event.shiftKey || event.metaKey) && event.key === "Enter") {
            // Allow multiline input
            event.preventDefault(); // Prevents default action (e.g., form submission)
            event.target.value += "\n";
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            this.sendMessage(event.target.value);
            this.autoExpand(event);
        }
    }


    //this function will work when user change model
    render_model(){
        let chat_model = document.getElementById("chat_model")
    }
    render_dropdown() {
        let selectedButton = document.getElementById("selected_model");
        let options = document.getElementById("select-options");
        let wrapper = document.getElementById("selected_model");
    
        if (wrapper) {
            wrapper.classList.toggle("active");
            options.classList.toggle("active");
    
            let div_option = document.querySelectorAll(".option");
            div_option.forEach(option => {
                option.addEventListener("click", (event) => { // Dùng arrow function
                    selectedButton.textContent = event.target.textContent; // Cập nhật nội dung button
                    this.chat_model = event.target.textContent; // Cập nhật giá trị this.chat_model    
                    wrapper.classList.remove("active");
                    options.classList.remove("active");
                });
            });
        }
    }
    
    
    
}

ChatController.template = "leandix_ai_base.template_chat";
export const customChatController = {
    ...formView, // contains the default Renderer/Controller/Model
    Controller: ChatController,
};

registry.category("views").add("chat_test_leandix", customChatController);



