import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Result "mo:base/Result";
import Nat "mo:base/Nat";
import Hash "mo:base/Hash";
import Array "mo:base/Array";
import Order "mo:base/Order";
import Text "mo:base/Text";

module {
    public type Doctor = {
        id: Nat;
        name: Text;
        email: Text;
        phone: Text;
        hospital: Text;
        department: Text;
        role: Text;
        publicKey: ?Text;
    };

    public type PagedResult = {
        items: [Doctor];
        total: Nat;
    };

    public class DoctorManager() {
        private var doctors = HashMap.HashMap<Nat, Doctor>(1, Nat.equal, Hash.hash);
        private var nextId : Nat = 1;

        public func createDoctor(doctor: Doctor) : Result.Result<Doctor, Text> {
            let id = nextId;
            nextId += 1;

            let newDoctor = {
                id = id;
                name = doctor.name;
                email = doctor.email;
                phone = doctor.phone;
                hospital = doctor.hospital;
                department = doctor.department;
                role = doctor.role;
                publicKey = null;
            };

            doctors.put(id, newDoctor);
            #ok(newDoctor)
        };

        public func updateDoctor(doctor: Doctor) : Result.Result<Doctor, Text> {
            switch (doctors.get(doctor.id)) {
                case (null) { #err("해당 ID의 의사를 찾을 수 없습니다.") };
                case (?existingDoctor) {
                    let updatedDoctor = {
                        id = doctor.id;
                        name = doctor.name;
                        email = doctor.email;
                        phone = doctor.phone;
                        hospital = doctor.hospital;
                        department = doctor.department;
                        role = doctor.role;
                        publicKey = existingDoctor.publicKey;
                    };
                    doctors.put(doctor.id, updatedDoctor);
                    #ok(updatedDoctor)
                };
            }
        };

        public func deleteDoctor(id: Nat) : Result.Result<(), Text> {
            switch (doctors.remove(id)) {
                case (null) { #err("해당 ID의 의사를 찾을 수 없습니다.") };
                case (?_) { #ok(()) };
            }
        };

        public func getAllDoctors(offset: Nat, limit: Nat) : PagedResult {
            let allDoctors = Iter.toArray(doctors.vals());
            
            // ID 기준 내림차순 정렬
            let sortedDoctors = Array.sort<Doctor>(
                allDoctors,
                func(a: Doctor, b: Doctor) : Order.Order {
                    if (a.id > b.id) { #less } 
                    else if (a.id < b.id) { #greater } 
                    else { #equal }
                }
            );

            // 페이지네이션 적용
            let total = sortedDoctors.size();
            let start = if (offset >= total) { total } else { offset };
            let end = if (start + limit > total) { total } else { start + limit };
            let pagedDoctors = Array.tabulate<Doctor>(
                end - start,
                func(i: Nat) : Doctor { sortedDoctors[start + i] }
            );

            {
                items = pagedDoctors;
                total = total;
            }
        };

        public func getDoctor(id: Nat) : ?Doctor {
            doctors.get(id)
        };

        public func getDoctorByEmail(email: Text) : ?Doctor {
            let doctorsArray = Iter.toArray(doctors.vals());
            Array.find<Doctor>(doctorsArray, func(doc: Doctor) : Bool {
                doc.email == email
            })
        };

        public func updateDoctorPublicKey(email: Text, publicKey: ?Text) : Result.Result<Doctor, Text> {
            let doctorOpt = getDoctorByEmail(email);
            
            switch (doctorOpt) {
                case (null) { #err("해당 이메일의 의사를 찾을 수 없습니다.") };
                case (?doctor) {
                    if (doctor.publicKey == null) {
                        let updatedDoctor = {
                            id = doctor.id;
                            name = doctor.name;
                            email = doctor.email;
                            phone = doctor.phone;
                            hospital = doctor.hospital;
                            department = doctor.department;
                            role = doctor.role;
                            publicKey = publicKey;
                        };
                        doctors.put(doctor.id, updatedDoctor);
                        #ok(updatedDoctor)
                    } else {
                        if (doctor.publicKey == publicKey) {
                            #ok(doctor)
                        } else {
                            #err("이미 다른 public key가 등록되어 있습니다.")
                        }
                    }
                };
            }
        };
    };
};