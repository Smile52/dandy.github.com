var domain = location.hostname.split(".")[0];
if('localhost'==location.hostname)
{
	domain = "luofei";
}
angular.module('deerResume', ['ngRoute','wiz.markdown','ngNotify','ui.router','jobdeer.service'])
.config(function($urlRouterProvider,$locationProvider,$stateProvider) {
	$urlRouterProvider.otherwise('/');
	$locationProvider.html5Mode(true).hashPrefix('!');
	// Now set up the states
	$stateProvider
		.state('admin', {
			url: "/admin",
			templateUrl: "view/admin.html?tplversion",
			controller:'adminCtrl'
		})
		.state('resume', {
			url: "/?preview&pwd",
			templateUrl: "view/resume.html?tplversion",
			controller:'resumeCtrl'
		})
		.state('login', {
			url: "/login",
			templateUrl: "view/login.html?tplversion",
			controller:'loginCtrl'
		})
		.state('deal_request', {
			url: "/deal_request?weixin_openid&request_id",
			templateUrl: "view/deal_request.html?tplversion",
			controller:'dealRequestCtrl'
		});

	})
.run(function($rootScope){
	 $rootScope.title="萌鹿简历";
})
.controller('dealRequestCtrl',function($scope,$stateParams,$jd,ngNotify){
	if(!$stateParams.weixin_openid || !$stateParams.request_id)
	{
		alert('传参错误');
		return ;
	}
	//读取请求信息
	$jd.get('resume/getRequest?resume_weixin_openid='+$stateParams.weixin_openid+'&request_id='+$stateParams.request_id).success(function(data){
			$scope.request = data;
			var status_arr={'-1':'未处理','0':'已拒绝','1':'已同意'}
			$scope.status=status_arr[data.status];
	});
	//处理请求函数
	$scope.deal=function(status)
	{
		$jd.post('resume/dealRequest',{
			request_id:$stateParams.request_id,
			status:status,
			resume_weixin_openid:$stateParams.weixin_openid
		}).success(function(){
			if(1==status){
				$scope.status="已同意";
			}else{
				$scope.status="已拒绝";
			}
			ngNotify.set('操作成功');
		});
	};
})
.controller('loginCtrl',function($location,$state){
	var search = $location.search();
	if(search.token)
	{
		localStorage.setItem('token',search.token);
		$state.go('admin');
	}
	else
	{
		alert("需要传递token");
	}
})
.controller('resumeCtrl', function ($scope,$http,$location,$jd, $rootScope) {

	var token = localStorage.getItem('token');
	if(!token)
	{
		token = "";
		$scope.has_token=false;
	}
	else
	{
		$scope.has_token=true;
	}
	var search = $location.search();
	var pwd = "";
	if(search.pwd)
	{
		localStorage.setItem('pwd',search.pwd);
		pwd=search.pwd;
		token = "";
	}
	else if(localStorage.getItem('pwd')){
		pwd=localStorage.getItem('pwd');
		token = "";
	}
	if(search.preview)
	{
		//预览的时候不带token
		token = "";
		pwd = "";
	}
	$scope.loading=true;
	$jd.get("resume/getContent?domain="+domain+"&token="+token+"&pwd="+pwd).success(function(data){
		$scope.loading=false;
		$rootScope.resume = $scope.resume = data;
		$rootScope.title=data.title+" by 萌鹿简历";
		//$.getScript('./ghostdown/js/ghostdown.js');
	});
})
.controller('adminCtrl', function ($rootScope,$scope,$state,$jd,ngNotify,jdModal,$timeout, jconfig) {
	var token = localStorage.getItem('token');
	if(!token)
	{
		ngNotify.set("没有token",'error');
		return ;
	}
	$scope.loading=true;
	$scope.side_close=false;
	$('body').css('overflow','hidden');
	$('.side_body').css('overflow','auto');
	var view_height = $(window).height()-70;
	$timeout(function(){
		 $('.side_body').height(view_height);
	},0);
	$scope.$on('$destroy',function(){
		$('body').css('overflow','auto');
	});
	$jd.get("resume/getContent?domain="+domain+"&token="+token).success(function(data){
		$scope.loading=false;
		if(!data.content)
		{
			//默认用默认模板的内容
			$.get('./tpl/default.md').success(function(content){
				data.content=content;
				$scope.resume = data;
				$scope.$apply();
				$timeout(function(){
					ghostdown_run(jQuery, Showdown, CodeMirror);
					$('.CodeMirror').height(view_height-20);
					$('.entry-preview-content').height(view_height-100);
				},0);
				//$.getScript('./ghostdown/js/ghostdown.js');
			});
		}
		else
		{
			$scope.resume = data;
			$rootScope.title=data.title+" by 萌鹿简历";
			$timeout(function(){
				ghostdown_run(jQuery, Showdown, CodeMirror);
				$('.CodeMirror').height(view_height-20);
				$('.entry-preview-content').height(view_height-100);
			},0);
			//$.getScript('./ghostdown/js/ghostdown.js');
		}
		$scope.weixin_openid = data.weixin_openid;
	});

	$scope.share_weixin = function(){
		jdModal('./view/weixin_share_qr.html','weixinShareCtrl');
	};

	$scope.cvUpload = function(){
		$scope.cv_upload_requesting = true;
		var url = jconfig.is_test? 'http://git.api.i.jobdeer.com/': 'http://api.jobdeer.com/';
		$.get(url+'resumecheck/check?weixin_openid='+$scope.weixin_openid).success(function(data){
			if(data.data.status == 'no_upload'){
				$scope.uploaded = false;
				$scope.countdown = 2;
				jdModal('./view/confirm_upload.html', 'confirmUploadCtrl', $scope);
			}else{
				jdModal('./view/notice_uploaded.html', 'confirmUploadCtrl');
				$scope.cv_upload_requesting = false;
			}
		});
	};

	$scope.tpl_change = function(tpl_id){
		if(confirm('以前的简历内容会丢失,是否确认切换模板。')){
			$.get('./tpl/'+tpl_id+'.md').success(function(data){
				window.ghost_editor_instance.setValue(data);
			});
		}
	};

	$scope.update = function(param, show_ret,is_preview){
		$jd.post('resume/update',param).success(function(data){
			if(show_ret){
				ngNotify.set("保存成功",'success');
			}
			if(is_preview){
				var url = $state.href('resume',{preview:1});
				window.open(url, '_blank');
			}
		});
	};

	$scope.save = function( resume ,show_ret, is_preview){
		var param = resume;
		param.token = localStorage.getItem('token');
		param.content = window.ghost_editor_instance.getValue();
		if(param.can_weixin_spread){
			if(!param.password){
				ngNotify.set("您开启了[ 扫码求简历 ], 但是没有输入密码");
			}else{
				if(param.content.indexOf('[password]') == -1){
					var scope = $scope.$new();
					scope.param = param;
					scope.show_ret = show_ret;
					scope.is_preview = is_preview;
					jdModal('./view/confirm_save.html','confirmSaveCtrl', scope);
				}else{
					$scope.update(param, show_ret, is_preview);
				}
			}
		}else{
			$scope.save(param, show_ret, is_preview);
		}
	};
})

.controller('confirmUploadCtrl',function($rootScope, $scope, $jd, $state, $timeout, ngNotify, jconfig){
	$scope.close = function(){
		$('#jobdeer-modal').modal('hide');
		$scope.cv_upload_requesting = false;
	};
	$scope.upload = function(){
		$scope.countdown = 2;
		var post = {
			'title':$('#resume_title').val(),
			'subtitle':$('#resume_subtitle').val(),
			'content':$('.rendered-markdown').html(),
			'pdfkey':'jobdeersocool',
			'weixin_openid':$scope.weixin_openid
		};
		var url = jconfig.is_test? 'http://git.api.i.jobdeer.com/': 'http://api.jobdeer.com/';
		$.post(url+'user/cvUploadResume',post).success(function(data){
			if(data.code>0){
				$scope.close();
				ngNotify.set('简历提交失败，有任何问题请微博私信@JobDeer', 'error');
			}else{
				$scope.uploaded = true;
				var send =function(){
					if($scope.countdown > 0){
						$scope.countdown--;
						$timeout(send, 1000);
					}else{
						$scope.cv_upload_requesting = false;
						var jump_url = jconfig.is_test? 'http://me.i.jobdeer.com/': 'http://me.jobdeer.com/';
						console.log(jump_url+ 'app/weixin_login?openid='+$scope.weixin_openid+'&redirect='+encodeURIComponent(jump_url+'app/seeker_resume_check?from=deercv&resume_id='+data.data.id+'&docid='+data.data.docid));
						location.href = jump_url+ 'app/weixin_login?openid='+$scope.weixin_openid+'&redirect='+encodeURIComponent(jump_url+'app/seeker_resume_check?from=deercv&resume_id='+data.data.id+'&docid='+data.data.docid);
					}
				}
				send();
			}
		}).error(function(data){
			$scope.close();
			ngNotify.set('简历提交失败，有任何问题请微博私信@JobDee', 'error');
		});
		$scope.uploaded = true;
	}
})

.controller('confirmSaveCtrl',function($scope, $jd, $state, ngNotify){
	$scope.update = function(param, show_ret,is_preview){
		$jd.post('resume/update',param).success(function(data){
			if(show_ret){
				ngNotify.set("保存成功",'success');
			}
			if(is_preview){
				var url = $state.href('resume',{preview:1});
				window.open(url, '_blank');
			}
		});
	}
})

.controller('weixinShareCtrl',function($scope){
	$scope.url= encodeURIComponent('http://'+location.hostname);
	$scope.url_with_password = encodeURIComponent('http://'+location.hostname+'?pwd='+$('#resume_password').val());
})
.controller('ghostdownCtrl',function($scope, $rootScope,jdModal){
	$scope.input_password=function(){
		jdModal('./view/password.html','passwordCtrl');
	};
	$scope.weixin_request=function(){
		jdModal('./view/request.html','requestCtrl', $rootScope);
	};
})
.controller('passwordCtrl',function($scope,$jd){
	$scope.set_password = function(password){
		location.href = '/?pwd='+password;
	};
})
.controller('requestCtrl',function($rootScope, $scope, $jd, $timeout){
	$scope.timeoutid = false;
	$scope.check_times = 0;
	$scope.status = false;
	console.log($scope);
	$jd.get('resume/getPwdQr?resume_id='+$scope.resume.id+'&slog_force_client_id=yangweijie_jay').success(function(data){
		localStorage.setItem('qrcode_token', data.token);
		$scope.loginQr = data.qrcodeurl;
		$scope.checkGetPwd(data.token);
	});

	$scope.reload = function(){
		location.reload();
	}

	//提交请求
	$scope.request = function(data){
		var formdata = data;
		formdata.resume_id = $rootScope.resume.id;
		formdata.visitor_weixin_openid = $scope.visitor_weixin_openid;
		$jd.post('resume/request', formdata).success(function(data){
			$scope.status = 'pendding_done';
		});
	}

	//登录检测
	$scope.checkGetPwd = function(token){
		console.log(token);
		$scope.check_times = $scope.check_times+1;
		$jd.post('resume/checkGetPwd', {token:token}).success(function(data){
			if(data.status != 'false'){
				$scope.status = data.status;
				$scope.visitor_weixin_openid = data.weixin_openid;
				return ;
			}else{
				if($scope.check_times > 60){
					//两分钟超时
					if($scope.timeoutid)
						$timeout.cancel($scope.timeoutid);
					$scope.timeout = true;
					return ;
				}
				$scope.timeoutid = $timeout(function(){
					$scope.checkGetPwd(token);
				},2000);
			}
		}).error(function(){
			$scope.checkGetPwd(token);
		});

		//监听是否切换tab
		$(document).on('visibilitychange',function(event){
			if(document.hidden){
				if($scope.timeoutid)
					$timeout.cancel($scope.timeoutid);
			}else{
				if(!$scope.timeout)
					$scope.checkGetPwd(token);
			}
		});
	}
});

// ============
function makepdf(){
	post('http://pdf.ftqq.com',{'title':$('#drtitle').html(),'subtitle':$('#drsubtitle').html(),'content':$('#cvcontent').html(),'pdfkey':'jobdeersocool'});
}
function admin_makepdf(){
	post('http://pdf.ftqq.com',{'title':$('#resume_title').val(),'subtitle':$('#resume_subtitle').val(),'content':$('.rendered-markdown').html(),'pdfkey':'jobdeersocool'});
}

function post(path, params, method) {
	method = method || "post"; // Set method to post by default if not specified.

	// The rest of this code assumes you are not using a library.
	// It can be made less wordy if you use one.
	var form = document.createElement("form");
	form.setAttribute("method", method);
	form.setAttribute("action", path);
	form.setAttribute("target", "_blank");

	for(var key in params) {
		if(params.hasOwnProperty(key)) {
			var hiddenField = document.createElement("input");
			hiddenField.setAttribute("type", "hidden");
			hiddenField.setAttribute("name", key);
			hiddenField.setAttribute("value", params[key]);

			form.appendChild(hiddenField);
		 }
	}

	document.body.appendChild(form);
	form.submit();
}


function pdf()
{
	var doc = new jsPDF();
	var specialElementHandlers = {
	'.action-bar': function(element, renderer){
			return true;
		}
	};

	doc.fromHTML($('#resume_body').get(0), 15, 15, {
		'width': 170,
		'elementHandlers': specialElementHandlers
	});

	doc.output("dataurlnewwindow");
}
