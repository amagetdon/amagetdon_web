import{s}from"./index-BJyr8rWh.js";const _={async getByUser(e){const{data:r,error:o}=await s.from("purchases").select("*").eq("user_id",e).order("purchased_at",{ascending:!1});if(o)throw o;return r},async getMyClassroom(e){const{data:r,error:o}=await s.from("purchases").select(`
        *,
        course:courses(
          *,
          instructor:instructors(id, name),
          curriculum_items(*)
        )
      `).eq("user_id",e).not("course_id","is",null).order("purchased_at",{ascending:!1});if(o)throw o;return r},async getMyEbooks(e){const{data:r,error:o}=await s.from("purchases").select(`
        *,
        ebook:ebooks(
          *,
          instructor:instructors(id, name)
        )
      `).eq("user_id",e).not("ebook_id","is",null).order("purchased_at",{ascending:!1});if(o)throw o;return r},async checkOwnership(e,r,o){let t=s.from("purchases").select("id",{count:"exact",head:!0}).eq("user_id",e);if(r)t=t.eq("course_id",r);else if(o)t=t.eq("ebook_id",o);else return!1;const{count:a,error:n}=await t;if(n)throw n;return(a??0)>0},async purchaseWithPoints(e,r,o,t,a){const{data:n,error:i}=await s.from("profiles").select("points").eq("id",e).single();if(i)throw i;if(!n||n.points<t)throw new Error("포인트가 부족합니다.");if(await this.checkOwnership(e,r.courseId,r.ebookId))throw new Error("이미 구매한 상품입니다.");const u=n.points-t,l=a?new Date(Date.now()+a*864e5).toISOString():null,{data:d,error:p}=await s.from("profiles").update({points:u}).eq("id",e).gte("points",t).select("id");if(p)throw new Error("포인트 차감에 실패했습니다.");if(!d||d.length===0)throw new Error("포인트가 부족합니다.");try{const{error:c}=await s.from("purchases").insert({user_id:e,course_id:r.courseId??null,ebook_id:r.ebookId??null,title:o,price:t,expires_at:l});if(c)throw c;const{error:w}=await s.rpc("insert_point_log",{p_user_id:e,p_amount:-t,p_balance:u,p_type:"use",p_memo:`${o} 구매`});if(w)throw w}catch(c){throw await s.rpc("add_points",{user_id_input:e,amount_input:t}),c}},async enrollFree(e,r,o,t){if(await this.checkOwnership(e,r.courseId,r.ebookId))throw new Error("이미 등록한 상품입니다.");const n=t?new Date(Date.now()+t*864e5).toISOString():null,{error:i}=await s.from("purchases").insert({user_id:e,course_id:r.courseId??null,ebook_id:r.ebookId??null,title:o,price:0,expires_at:n});if(i)throw i}};export{_ as p};
