/* 고객·점주 화면이 함께 쓰는 설정이에요. 비어 있는 값은 직접 채워 주세요. */
window.APP_CONFIG={
  API_ORIGIN:"https://capstone2-backend-production.up.railway.app/api",
  STORE_ID:"",              // 매장 등록 때 서버가 만든 8자 ID. 비워 두면 주소 뒤에 ?store=매장ID 를 붙여도 돼요 (한 번 쓰면 브라우저가 기억해요)
  KAKAO_JS_KEY:"",          // 카카오 개발자 콘솔의 JavaScript 키 (고객 로그인)
  KAKAO_REDIRECT_URI:"",    // 비워 두면 현재 페이지 주소(쿼리 제외). 서버의 KAKAO_REDIRECT_URI, 카카오 콘솔 등록값과 한 글자도 다르면 안 돼요
  SPOTIFY_CLIENT_ID:"",     // Spotify 개발자 대시보드의 Client ID (점주 재생)
  SPOTIFY_REDIRECT_URI:""   // 비워 두면 점주 페이지 주소(쿼리 제외). 대시보드 Redirect URIs에 같은 값을 등록해야 해요
};
