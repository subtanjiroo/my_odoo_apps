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

import json
import requests
from odoo import models, fields,api
from odoo.http import request
import logging
import os
from . import utilities
from . import session
# Load biến từ .env thủ công (1 dòng)
if os.path.exists('.env'):
    for line in open('.env'):
        if line.strip() and not line.startswith('#'):
            k, v = line.strip().split('=', 1)
            os.environ.setdefault(k, v)

server_api = os.environ.get("SERVER_API")
_logger = logging.getLogger(__name__)

class chat_history(models.Model):
    _name = 'leandix.ai.base.chat.history'
    _description ='Chat History'

    name = fields.Char(string='Name')
    messages = fields.One2many('leandix.ai.base.chat.message', 'chat_id', string='Messages')
    user = fields.Many2one('res.users', string='User')

    @api.model
    def get_values(self):
        value = server_api
        return {"value": value}
    
    @api.model
    def get_current_chat_history_by_uid(self, uid, chat_id):
        if chat_id == 0 or chat_id == None:
            return []
        history = self.get_history_by_uid(uid)

        # Tìm đoạn chat có id tương ứng
        selected_chat = next((chat for chat in history if chat.get('id') == chat_id), None)

        if not selected_chat:
            return []  # Không tìm thấy thì trả mảng rỗng

        messages = selected_chat.get('messages', [])
        # Lấy 10 tin nhắn gần nhất (cuối danh sách)
        recent_messages = messages[-10:]
        _logger.info(f"historyhistory: {history}")
        _logger.info(f"recent_messagesrecent_messages: {recent_messages}")
        return recent_messages


    @api.model
    def get_history_by_uid(self, uid):
        history_id = self.env['leandix.ai.base.chat.history'].search([('user', '=', uid)])
        ans = []
        for record in history_id:
            temp_ans_dict = {}
            temp_ans_dict['name'] = record.name
            temp_ans_dict['id']=record.id
            temp_ans_dict['messages'] = []

            for message in record.messages:
                temp_ans_dict['messages'].append({
                    'message': message.message,
                    'role': message.role
                })
            ans.append(temp_ans_dict)
        _logger.info(f"ansansans: {ans}")
        return ans

    # This function will create new conversation in Odoo DB
    @api.model
    def create_new_conversation(self, uid, name):
        # Tạo cuộc trò chuyện mới với tên đã lấy được
        new_chat = self.create({
            'name': name,
            'user': uid
        })
        return {'id': new_chat.id, 'name': new_chat.name}

    
    @api.model
    def add_message(self, chat_id, role, message):
        msg = self.env['leandix.ai.base.chat.message'].create({
            'message': message,
            'role': role,
            'chat_id': chat_id
        })
        return msg.id

    def delete_conversations(self, chat_ids):
        """
        Xóa nhiều cuộc trò chuyện theo danh sách ID.

        :param chat_ids: Danh sách ID của cuộc trò chuyện cần xóa
        :return: Thông báo kết quả xóa
        """
        if not chat_ids or not isinstance(chat_ids, list):
            return {'success': False, 'message': 'Danh sách chat_id không hợp lệ'}

        conversations = self.search([('id', 'in', chat_ids)])
        if not conversations:
            _logger.warning(f"Không tìm thấy cuộc trò chuyện với ID {chat_ids}")
            return {'success': False, 'message': 'Không tìm thấy cuộc trò chuyện nào'}

        try:
            conversations.unlink()
            _logger.info(f"Đã xóa các cuộc trò chuyện có ID {chat_ids}")
            return {'success': True, 'message': 'Đã xóa tất cả cuộc trò chuyện được chọn'}
        except Exception as e:
            _logger.error(f"Lỗi khi xóa cuộc trò chuyện ID {chat_ids}: {e}")
            return {'success': False, 'message': 'Lỗi khi xóa cuộc trò chuyện'}

