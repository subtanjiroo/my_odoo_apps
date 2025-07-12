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
from .utilities import *
_logger = logging.getLogger(__name__)


class session_model(models.Model):
    _name = 'leandix.ai.session'
    _description ='Odoo Session Storage'

    # @api.model  
    # def get_current_user_info(self):
    #     try:
    #         ai_utilites = request.env['leandix.utilities.model']
    #         ai_utilites.store_in_session("current_convs_id",id,"int")
    #     except Exception as e:
    #         _logger.error(f"Error in get_current_user_info: {e}")
    #         return "error"

    @api.model
    def set_new_conversation(self):
        try:
            store_in_session("current_convs_id", 0, "int")
            return "success clearing"
        except KeyError:
            _logger.info("current_convs_id not found in session. Set to '0'.")

    @api.model
    def get_session_conversation(self):
        return request.session.get('current_convs_id')
    

    @api.model
    def check_new_conversation(self):
        try:
            session_data = request.session['current_convs_id']
            data = session_data["value"]
            _logger.info(f"current_convs_id in session: {data}")
            if data == 0 or data == None:
                store_in_session("current_convs_id", 0, "int")
                return True
            else:
                return False
        except KeyError:
            store_in_session("current_convs_id", 0, "int")
            _logger.info("current_convs_id not found in session. Set to '0'.")

    @api.model    
    def save_current_chat_id(self,id):
        try:
            store_in_session("current_convs_id",id,"int")
            _logger.info(f"Saved session current_convs_id: {request.session['current_convs_id']}")
        except Exception as e:
            _logger.error(f"Error in check_api_type: {e}")
            return "error"
