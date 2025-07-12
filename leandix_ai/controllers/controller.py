# -*- coding: utf-8 -*-
#
# Copyright (c) 2025 CanhCamsSolutions
# All rights reserved.
# Licensed under the CanhCamsSolutions Proprietary License.
#
# You may modify the source code for internal use only,
# but you may NOT remove or alter the author or company name.
# Commercial use, resale, or redistribution is strictly prohibited.
#
# See LICENSE file for full license terms.
import time
from odoo.http import request, Response
from odoo import http
from odoo.http import request
import logging
from datetime import datetime
from ..models.utilities import *
_logger = logging.getLogger(__name__)

# Hàm hỗ trợ: chuyển đổi datetime sang string để JSON không lỗi
def serialize_datetimes(data):
    """Đệ quy chuyển datetime thành chuỗi ISO format"""
    if isinstance(data, list):
        return [serialize_datetimes(item) for item in data]
    elif isinstance(data, dict):
        return {k: serialize_datetimes(v) for k, v in data.items()}
    elif isinstance(data, datetime):
        return data.isoformat()  # hoặc dùng .strftime("%Y-%m-%d %H:%M:%S")
    else:
        return data
# enviroment_api = "http://chat_engine-back_end-1:5000"
enviroment_api = "https://api.leandix.com"

class LeandixChatController(http.Controller):

    @http.route('/leandix_ai/get_direct_answer', type='http', auth='user', cors='*', csrf=False)
    def get_direct_answer(self, **kwargs):
        user_message = kwargs.get('message')
        chat_model = kwargs.get('chat_model')

        if not user_message or not chat_model:
            return Response("Thiếu message hoặc chat_model", status=400)

        # Trích xuất ORM trước khi stream
        env = request.env
        current_user_id = env.uid
        ai_session = env['leandix.ai.session'].sudo()
        ai_model = env['leandix.ai.chat.model'].sudo()
        ai_history = env['leandix.ai.chat.history'].sudo()
        config = env["ir.config_parameter"].sudo()
        API_key = config.get_param("API_key")
        lang = ai_model.get_current_user_lang().get("lang", "en_US")
        current_convs_id = request.session.get("current_convs_id", {})
        
        if not API_key:
            return "[E]" + get_error_message(422,lang)

        # Khởi tạo conversation & history
        new_conversation = ai_session.check_new_conversation()
        convs_id = current_convs_id.get("value")
        history = ai_history.get_current_chat_history_by_uid(current_user_id, convs_id) or []
        if new_conversation:
            new_conv = ai_model.naming_and_create_conversation(user_message, chat_model, current_user_id)
            _logger.info(f"new_convnew_convnew_conv: {new_conv}")

            if isinstance(new_conv, int):
                return "[E]" + get_error_message(new_conv, lang)
            
            ai_history.add_message(new_conv["id"], "user", user_message)
            ai_session.save_current_chat_id(new_conv["id"])
            convs_id = new_conv["id"]
        else:
            _logger.info(f"convs_idconvs_idconvs_id: {convs_id}")
            ai_history.add_message(convs_id, "user", user_message)

        retry_count = 0
        max_retry = 3
        sql_result = None 
        error = None
        while retry_count < max_retry:
            try:
                # ✅ Gọi lại engine để lấy SQL mới mỗi lần thử
                raw_sql_query = ai_model.send_message_to_engine_api(
                    user_message, history, chat_model, current_user_id, error
                )
                sql_query = raw_sql_query.get("message", {}).get("sql_query")

                if not sql_query:
                    answer = raw_sql_query.get("message", {}).get("sql_generator_query")
                    if answer:
                        # ai_history.add_message(convs_id, "system", answer)

                        def stream_answer():
                            yield "[NS]"
                            for word in answer.split():
                                yield word + " "
                                time.sleep(0.05)


                        return Response(stream_answer(), content_type='text/plain;charset=utf-8')

                _logger.info(f"🔁 Thử lần {retry_count + 1} với SQL:\n{sql_query}")
                sql_result = ai_model.get_data_from_DB(sql_query, current_user_id)
                _logger.info(f"🎯 Kết quả sql_result:\n{sql_result}")

                if sql_result and sql_result.get("data"):  # ✅ Nếu có data thật thì break
                    error = None
                    break
                else:
                    error = sql_result.get("message") if isinstance(sql_result, dict) else getattr(sql_result, "message", None)
                    _logger.info(f"🎯 errorerrorerror: {error}")
                    _logger.warning(
                        f"⚠️ Dữ liệu `data` rỗng ở lần thử {retry_count + 1}. SQL:\n{sql_result.get('query') or sql_query}"
                    )
                    if error and "does not exist" in error:
                        _logger.warning("Module hoặc bảng dữ liệu không tồn tại.")
                        sql_result = "This user doesn't have the required module or data."
                        break
                    retry_count += 1  # tiếp tục thử lại

            except Exception as e:
                retry_count += 1
                _logger.warning(f"❌ Lỗi tại lần thử {retry_count}: {str(e)}")

                if retry_count >= max_retry:
                    _logger.error(f"❌ Đã thử lại {retry_count} lần nhưng không có dữ liệu.")
                    sql_result = "[Failed] Lấy data thất bại nhờ người dùng thử lại"
                    break

        # ✅ Nếu là dict thì serialize, nếu không thì giữ nguyên
        if isinstance(sql_result, dict):
            sql_result_clean = serialize_datetimes(sql_result)
        else:
            sql_result_clean = sql_result


        payload = {
            "message": user_message,
            "sql_query": sql_query,
            "sql_result": f"{sql_result_clean}",
            "chat_model": chat_model,
            "user_id": str(current_user_id),
            "history": history,
            "API_key": API_key,
            "lang": lang,
            "current_chat_id": str(current_convs_id),
        }

        api_url = f"{enviroment_api}/answer_streaming"
        _logger.info("⚡ Bắt đầu stream tới AI engine...")

        def generate():
            buffer = ""
            for chunk in ai_model.send_message_to_answer_api_stream_prepared(payload, api_url):
                _logger.info(f"🧩 Chunk nhận được: {chunk[:50]}")
                buffer += chunk
                yield chunk
            yield f"\n[SAVE_CHAT_ID]:{convs_id}"

        return Response(generate(), content_type='text/plain;charset=utf-8')


