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
from odoo import models, api
from odoo.http import request
import logging
import os
_logger = logging.getLogger(__name__)
class utilities_model(models.Model):
    _name = 'leandix.utilities.model'
    _description = 'utilities in here'

def store_in_session(key: str, value, value_type: str = "str"):
    try:
        if value_type == 'int':
            value = int(value)
        elif value_type == 'float':
            value = float(value)
        elif value_type == 'bool':
            value = bool(value) if isinstance(value, bool) else value in ('1', 'true', 'True', 'yes')
        elif value_type == 'str':
            value = str(value)
        else:
            raise ValueError(f"Unsupported type: {value_type}")
    except Exception as e:
        raise ValueError(f"Invalid value for type {value_type}: {e}")

    request.session[key] = {
        'value': value,
        'type': value_type,
    }


def get_error_message(status_code: int, lang_code: str = 'en_US') -> str:
    # Danh sách thông điệp lỗi theo mã lỗi và mã ngôn ngữ
    ERROR_MESSAGES = {
        401: {
            'vi_VN': 'API key không hợp lệ hoặc chưa có, hãy nhập lại API key ở <a href="/odoo/settings#leandix_ai_base" style="color: #0084ff;">Cài Đặt</a> hoặc liên hệ với <a href="https://leandix.com" style="color: #0084ff;">ADMIN</a> để được hỗ trợ.',
            'en_US': 'The API key is invalid or missing. Please enter it again in the <a href="/odoo/settings#leandix_ai_base" style="color: #0084ff;">Settings</a> or contact <a href="https://leandix.com" style="color: #0084ff;">ADMIN</a> for support.'
        },
        422: {
            'vi_VN': 'API key không hợp lệ hoặc chưa có, hãy nhập lại API key ở <a href="/odoo/settings#leandix_ai_base" style="color: #0084ff;">Cài Đặt</a> hoặc liên hệ với <a href="https://leandix.com" style="color: #0084ff;">ADMIN</a> để được hỗ trợ.',
            'en_US': 'The API key is invalid or missing. Please enter it again in the <a href="/odoo/settings#leandix_ai_base" style="color: #0084ff;">Settings</a> or contact <a href="https://leandix.com" style="color: #0084ff;">ADMIN</a> for support.'
        },
        402: {
            'vi_VN': 'Bạn đã hết lượt thử, hãy quay lại vào ngày mai hoặc liên hệ với <a style="color: #0084ff;" href="https://leandix.com" target="_blank">ADMIN</a> để được nâng cấp lên Pro.',
            'en_US': 'You have reached your trial limit. Please come back tomorrow or contact <a style="color: #0084ff;" href="https://leandix.com" target="_blank">ADMIN</a> to upgrade to Pro.'
        },
        403: {
            'vi_VN': 'Bạn đã hết dung lượng sử dụng (Tokens), hãy liên hệ với <a style="color: #0084ff;" href="https://leandix.com" target="_blank">ADMIN</a> để được hỗ trợ thêm.',
            'en_US': 'You have reached your usage limit (Tokens). Please contact the <a style="color: #0084ff;" href="https://leandix.com" target="_blank">ADMIN</a> for further assistance.'
        },
        500: {
            'vi_VN': (
                'Hệ thống gặp lỗi không xác định. Vui lòng thử lại hoặc liên hệ với '
                '<a href="https://leandix.com" target="_blank" style="color: #0084ff;">ADMIN</a> để được hỗ trợ.'
            ),
            'en_US': (
                'The system encountered an unexpected error. Please try again or contact '
                '<a href="https://leandix.com" target="_blank" style="color: #0084ff;">ADMIN</a> for support.'
            )
        }
    }

    # Mặc định lang_code là en_US nếu không nằm trong danh sách hỗ trợ
    lang = lang_code if lang_code in ['vi_VN', 'en_US'] else 'en_US'

    # Lấy thông điệp
    message = ERROR_MESSAGES.get(status_code, {}).get(lang)

    if message:
        return message
    else:
        _logger.info(f"[get_error_message] Unknown error code: {status_code}, lang: {lang_code}")
        return 'Unknown error.' if lang == 'en_US' else 'Lỗi không xác định.'
